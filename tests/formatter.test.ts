import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { streamFormattedText } from '../src/formatter';
import Anthropic from '@anthropic-ai/sdk';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
    const streamResult = async function* () {
        yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'I wanted to ' }
        };
        yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'say hello' }
        };
    };

    const MockAnthropic = vi.fn().mockImplementation(() => {
        return {
            messages: {
                stream: vi.fn().mockReturnValue({
                    [Symbol.asyncIterator]: streamResult,
                    finalMessage: vi.fn().mockResolvedValue({ role: 'assistant', content: [] })
                })
            }
        };
    });

    return { default: MockAnthropic };
});

describe('streamFormattedText', () => {
    const mockApiKey = 'sk-ant-mock-key';

    beforeEach(() => {
        vi.stubEnv('ANTHROPIC_API_KEY', mockApiKey);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.clearAllMocks();
    });

    it('formats text correctly ("um so I uh wanted to say hello" → "I wanted to say hello")', async () => {
        const onToken = vi.fn();
        const result = await streamFormattedText({
            rawTranscript: 'um so I uh wanted to say hello',
            appName: 'test-app',
            onToken
        });

        // Validates the mocked stream reassembled properly
        expect(result).toBe('I wanted to say hello');
    });

    it('informs the system prompt with appName context', async () => {
        const onToken = vi.fn();
        await streamFormattedText({
            rawTranscript: 'hello there',
            appName: 'slack',
            onToken
        });

        const anthropicInstance = vi.mocked(Anthropic).mock.results[0].value;
        const streamCall = anthropicInstance.messages.stream.mock.calls[0][0];

        // Check if slack is in the prompt
        expect(streamCall.system).toContain('slack');
    });

    it('streaming tokens fire onToken and reassemble into correct fullText on done', async () => {
        const onToken = vi.fn();
        const result = await streamFormattedText({
            rawTranscript: 'test',
            appName: 'test-app',
            onToken
        });

        expect(onToken).toHaveBeenCalledTimes(2);
        expect(onToken).toHaveBeenNthCalledWith(1, 'I wanted to ');
        expect(onToken).toHaveBeenNthCalledWith(2, 'say hello');

        // Validate final output
        expect(result).toBe('I wanted to say hello');
    });
});
