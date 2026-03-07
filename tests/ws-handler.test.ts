import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import websocketPlugin from '@fastify/websocket';
import { registerTranscribeWsRoute } from '../src/ws-handler';
import WebSocket from 'ws';

// We need to mock 'transcribeWithMiniMax' and 'streamFormattedText'
vi.mock('../src/asr', () => ({
    transcribeWithMiniMax: vi.fn().mockResolvedValue('mock transcript')
}));

vi.mock('../src/formatter', () => ({
    streamFormattedText: vi.fn().mockImplementation(async ({ onToken }) => {
        onToken('hello');
        onToken(' world');
        return 'hello world';
    })
}));

describe('ws-handler route', () => {
    let fastify: ReturnType<typeof Fastify>;
    let wsUrl: string;

    beforeAll(async () => {
        fastify = Fastify();
        await fastify.register(websocketPlugin);
        await registerTranscribeWsRoute(fastify);

        // Listen on dynamic port
        const port = await fastify.listen({ port: 0, host: '127.0.0.1' });
        const address = fastify.server.address() as any;
        wsUrl = `ws://127.0.0.1:${address.port}/transcribe`;
    });

    afterAll(async () => {
        await fastify.close();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('missing context message is handled gracefully', () => {
        return new Promise<void>((resolve, reject) => {
            const ws = new WebSocket(wsUrl);

            ws.on('open', () => {
                ws.send(JSON.stringify({ type: 'audio_chunk', data: 'abcd' }));
            });

            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    expect(msg.type).toBe('error');
                    expect(msg.data).toContain('First message must be { type: "context", appName: string }');
                    ws.close();
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        });
    });

    it('malformed JSON message does not crash server', () => {
        return new Promise<void>((resolve, reject) => {
            const ws = new WebSocket(wsUrl);

            ws.on('open', () => {
                ws.send('invalid json {[');
            });

            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    expect(msg.type).toBe('error');
                    expect(msg.data).toBe('Message must be valid JSON');
                    ws.close();
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        });
    });

    it('5 sequential audio_chunk messages accumulate correctly and end_stream triggers ASR', () => {
        return new Promise<void>((resolve, reject) => {
            const ws = new WebSocket(wsUrl);
            const messages: any[] = [];

            ws.on('open', () => {
                // Send context
                ws.send(JSON.stringify({ type: 'context', appName: 'slack' }));

                // Send 5 audio chunks (base64 encoded 'chunk')
                const b64 = Buffer.from('chunk').toString('base64');
                for (let i = 0; i < 5; i++) {
                    ws.send(JSON.stringify({ type: 'audio_chunk', data: b64 }));
                }

                // Send end_stream
                ws.send(JSON.stringify({ type: 'end_stream' }));
            });

            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    messages.push(msg);

                    if (msg.type === 'done') {
                        // We should have received 2 tokens and 1 done message
                        expect(messages).toHaveLength(3);
                        expect(messages[0]).toEqual({ type: 'token', data: 'hello' });
                        expect(messages[1]).toEqual({ type: 'token', data: ' world' });
                        expect(messages[2]).toEqual({ type: 'done', data: 'hello world' });

                        ws.close();
                        resolve();
                    } else if (msg.type === 'error') {
                        reject(new Error(`Server sent error: ${msg.data}`));
                    }
                } catch (err) {
                    reject(err);
                }
            });
        });
    });
});
