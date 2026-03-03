import type { FastifyInstance } from 'fastify';
import type WebSocket from 'ws';
import { transcribeWithMiniMax } from './asr.js';
import { handleCommand } from './command.js';
import { streamFormattedText } from './formatter.js';
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
  fastify.get('/transcribe', { websocket: true }, (socket) => {
    const state: WsSessionState = {
      appName: undefined,
      isContextSet: false,
      audioChunks: []
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

      try {
        if (message.type === 'context') {
          state.appName = message.appName;
          state.isContextSet = true;
          return;
        }

        const appName = assertContext(state);

        if (message.type === 'audio_chunk') {
          const chunk = decodeAudioChunk(message.data);
          if (chunk.length === 0) {
            throw new Error('audio_chunk.data decoded to empty buffer');
          }
          state.audioChunks.push(chunk);
          return;
        }

        if (message.type === 'command') {
          const result = handleCommand({
            instruction: message.instruction,
            clipboardContent: message.clipboardContent,
            appName
          });
          sendMessage(socket, { type: 'command_result', data: result });
          return;
        }

        if (message.type === 'end_stream') {
          if (state.audioChunks.length === 0) {
            throw new Error('No audio chunks received before end_stream');
          }

          const fullAudio = Buffer.concat(state.audioChunks);
          state.audioChunks = [];

          const transcript = await transcribeWithMiniMax(fullAudio.toString('base64'));
          const formatted = await streamFormattedText({
            rawTranscript: transcript,
            appName,
            onToken: (token) => {
              sendMessage(socket, { type: 'token', data: token });
            }
          });

          sendMessage(socket, { type: 'done', data: formatted });
          return;
        }
      } catch (error) {
        const messageText = error instanceof Error ? error.message : 'Unknown server error';
        state.audioChunks = [];
        sendMessage(socket, { type: 'error', data: messageText });
      }
    });
  });
}
