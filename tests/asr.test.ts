import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { transcribeWithMiniMax } from '../src/asr';

describe('transcribeWithMiniMax', () => {
    const mockBase64Pcm = Buffer.from('mock audio data').toString('base64');
    const mockApiKey = 'sk-mock-key';

    beforeEach(() => {
        vi.stubEnv('MINIMAX_API_KEY', mockApiKey);
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
    });

    it('successful transcription returns string', async () => {
        // Mock the createJob fetch
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                task_id: 'task-123',
                pollUrl: 'https://api.minimax.io/v1/stt/query?task_id=task-123'
            })
        } as any);

        // Mock the polling fetch
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                status: 'success',
                text: 'hello world'
            })
        } as any);

        const result = await transcribeWithMiniMax(mockBase64Pcm);
        expect(result).toBe('hello world');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('429 response triggers 1s retry, succeeds on second call', async () => {
        const fetchMock = vi.mocked(fetch);

        // 1st create response: 429 Too Many Requests
        fetchMock.mockResolvedValueOnce({
            status: 429,
            ok: false,
            text: async () => 'Too Many Requests'
        } as any);

        // 2nd create response (retry): Success
        fetchMock.mockResolvedValueOnce({
            status: 200,
            ok: true,
            json: async () => ({
                task_id: 'task-456'
            })
        } as any);

        // Poll response: Success
        fetchMock.mockResolvedValueOnce({
            status: 200,
            ok: true,
            json: async () => ({
                status: 'done',
                text: 'retry success'
            })
        } as any);

        const startTime = Date.now();
        const result = await transcribeWithMiniMax(mockBase64Pcm);
        const duration = Date.now() - startTime;

        expect(result).toBe('retry success');
        expect(fetchMock).toHaveBeenCalledTimes(3);
        // Ensure at least ~1000ms elapsed due to the sleep in loop
        expect(duration).toBeGreaterThanOrEqual(950);
    });

    it('base64 PCM buffer encodes/decodes correctly', async () => {
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ task_id: 'task-789' })
        } as any);
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'done', text: 'decoded' })
        } as any);

        const originalText = 'some binary audio data';
        const base64Audio = Buffer.from(originalText, 'utf-8').toString('base64');

        await transcribeWithMiniMax(base64Audio);

        // Verify what was sent to fetch in the POST request body
        const createCall = fetchMock.mock.calls[0];
        const requestOptions = createCall[1] as RequestInit;
        const requestBody = JSON.parse(requestOptions.body as string);

        expect(requestBody.audio).toBe(base64Audio);

        // Decode and verify it matches original
        const decoded = Buffer.from(requestBody.audio, 'base64').toString('utf-8');
        expect(decoded).toBe(originalText);
    });
});
