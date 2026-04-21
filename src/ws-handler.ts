import type { FastifyInstance } from 'fastify';
import type WebSocket from 'ws';
import { transcribeAudio, transcribePartial } from './asr-wcpp.js';
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
      corrections: []
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
          state.corrections = message.corrections ?? [];
          state.skipFormatter = message.skipFormatter ?? false;
          console.log(`[ws] context set, appName=${message.appName}, skipFormatter=${state.skipFormatter}`);
          return;
        }

        assertContext(state);

        if (message.type === 'audio_chunk') {
          const chunk = decodeAudioChunk(message.data);
          if (chunk.length === 0) {
            throw new Error('audio_chunk.data decoded to empty buffer');
          }
          state.audioChunks.push(chunk);

          // Streaming-during-capture: kick a partial transcribe every ~1.5s of accumulated audio,
          // one at a time. Purely UX — lets the renderer display live text while speaking.
          const totalBytes = state.audioChunks.reduce((sum, c) => sum + c.length, 0);
          const totalSec = totalBytes / 2 / 16000;
          const now = Date.now();
          const elapsed = now - (state.lastPartialAt ?? 0);
          if (!state.partialInFlight && totalSec >= 1.5 && elapsed >= 800) {
            state.partialInFlight = true;
            state.lastPartialAt = now;
            const snapshot = Buffer.concat(state.audioChunks);
            transcribePartial(snapshot.toString('base64'))
              .then((text) => {
                if (text) sendMessage(socket, { type: 'partial', data: text });
              })
              .catch((err) => console.warn('[ws] partial transcribe failed:', err))
              .finally(() => { state.partialInFlight = false; });
          }
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
          state.partialInFlight = false;
          state.lastPartialAt = undefined;

          console.log(`[ws] STT starting, audio size=${fullAudio.length} bytes`);
          const transcript = await transcribeAudio(fullAudio.toString('base64'));
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
              corrections: state.corrections,
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
            corrections: state.corrections,
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
