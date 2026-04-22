import type { FastifyInstance } from 'fastify';
import type WebSocket from 'ws';
import { transcribeAudio } from './asr-wcpp.js';
import { handleCommand } from './command.js';
import { streamFormattedText } from './formatter.js';
import { ruleFormat } from './rule-formatter.js';
import { ClientMessageSchema, type ServerMessage, type WsSessionState } from './types.js';

function sendMessage(socket: WebSocket, payload: ServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function decodeAudioChunk(base64Data: string): Buffer {
  const chunk = Buffer.from(base64Data, 'base64');
  if (chunk.length === 0 && base64Data.trim().length > 0) {
    throw new Error('audio_chunk.data must be valid base64');
  }
  return chunk;
}

function assertContext(state: WsSessionState): string {
  if (!state.isContextSet || !state.appName) {
    throw new Error('First message must be { type: "context", appName: string }');
  }
  return state.appName;
}

export async function registerTranscribeWsRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/transcribe', { websocket: true }, (socket, _request) => {
    const state: WsSessionState = {
      appName: undefined,
      isContextSet: false,
      audioChunks: [],
      vocabulary: []
    };

    socket.on('message', async (rawData: WebSocket.RawData) => {
      let parsedJson: unknown;

      try {
        parsedJson = JSON.parse(rawData.toString());
      } catch {
        sendMessage(socket, { type: 'error', data: 'Message must be valid JSON' });
        return;
      }

      const parsed = ClientMessageSchema.safeParse(parsedJson);
      if (!parsed.success) {
        sendMessage(socket, {
          type: 'error',
          data: `Invalid message: ${parsed.error.issues.map((i) => i.message).join('; ')}`
        });
        return;
      }

      const message = parsed.data;
      console.log(`[ws] received: ${message.type}`);

      try {
        if (message.type === 'context') {
          state.appName = message.appName;
          state.isContextSet = true;
          state.vocabulary = message.vocabulary ?? [];
          state.skipFormatter = message.skipFormatter ?? false;
          console.log(`[ws] context set, appName=${message.appName}, vocab=${state.vocabulary.length}, skipFormatter=${state.skipFormatter}`);
          return;
        }

        assertContext(state);

        if (message.type === 'audio_chunk') {
          const chunk = decodeAudioChunk(message.data);
          if (chunk.length === 0) {
            throw new Error('audio_chunk.data decoded to empty buffer');
          }
          state.audioChunks.push(chunk);
          return;
        }

        if (message.type === 'command') {
          const fullText = await handleCommand(
            {
              instruction: message.instruction,
              clipboardContent: message.clipboardContent
            },
            (tok) => {
              sendMessage(socket, { type: 'token', data: tok });
            }
          );

          sendMessage(socket, { type: 'done', data: fullText });
          return;
        }

        if (message.type === 'end_stream') {
          if (state.audioChunks.length === 0) {
            throw new Error('No audio chunks received before end_stream');
          }

          const t0 = Date.now();
          const fullAudio = Buffer.concat(state.audioChunks);
          state.audioChunks = [];

          console.log(`[ws] STT starting, audio size=${fullAudio.length} bytes`);
          const transcript = await transcribeAudio(fullAudio.toString('base64'), {
            vocabulary: state.vocabulary,
            appName: state.appName,
          });
          console.log(`[timing] STT: ${Date.now() - t0}ms — "${transcript}"`);

          // Send raw transcript to Electron for "hey voxi" detection
          sendMessage(socket, { type: 'raw_transcript', data: transcript });

          // If it's a "hey voxi" command, skip formatting — Electron will send a command message
          if (transcript.toLowerCase().startsWith('hey voxi')) {
            return;
          }

          // Raw/fast mode: deterministic rule-based formatter, no LLM. Default path.
          if (state.skipFormatter || !transcript.trim()) {
            const tRule = Date.now();
            const formatted = ruleFormat({
              rawTranscript: transcript,
              appName: state.appName!,
            });
            console.log(`[timing] rule-format: ${Date.now() - tRule}ms (skipFormatter=${state.skipFormatter})`);
            console.log(`[timing] end-to-end: ${Date.now() - t0}ms`);
            sendMessage(socket, { type: 'done', data: formatted });
            return;
          }

          // Normal dictation: format and stream
          const t1 = Date.now();
          let firstToken = true;
          const formatted = await streamFormattedText({
            rawTranscript: transcript,
            appName: state.appName!,
            onToken: (tok) => {
              if (firstToken) {
                console.log(`[timing] LLM first token: ${Date.now() - t1}ms`);
                firstToken = false;
              }
              sendMessage(socket, { type: 'token', data: tok });
            }
          });
          console.log(`[timing] LLM total: ${Date.now() - t1}ms`);
          console.log(`[timing] end-to-end: ${Date.now() - t0}ms`);

          sendMessage(socket, { type: 'done', data: formatted });
          return;
        }
      } catch (error) {
        const messageText = error instanceof Error ? error.message : 'Unknown server error';
        console.error('[ws] error:', messageText);
        state.audioChunks = [];
        sendMessage(socket, { type: 'error', data: messageText });
      }
    });
  });
}
