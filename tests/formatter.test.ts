import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { streamFormattedText } from '../src/formatter'

// Helper to create a mock readable stream from JSON lines
function makeStreamBody(lines: string[]) {
  const text = lines.join('\n')
  const encoder = new TextEncoder()
  return {
    getReader: () => {
      let done = false
      return {
        read: vi.fn().mockImplementationOnce(() =>
          Promise.resolve({ done: false, value: encoder.encode(text) })
        ).mockImplementationOnce(() =>
          Promise.resolve({ done: true, value: undefined })
        )
      }
    }
  }
}

describe('streamFormattedText (Ollama)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('streams tokens correctly and returns full text', async () => {
    const lines = [
      JSON.stringify({ message: { content: 'I wanted to ' }, done: false }),
      JSON.stringify({ message: { content: 'say hello' }, done: false }),
      JSON.stringify({ message: { content: '' }, done: true }),
    ]

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      body: makeStreamBody(lines)
    } as any)

    const onToken = vi.fn()
    const result = await streamFormattedText({
      rawTranscript: 'um so I uh wanted to say hello',
      appName: 'test-app',
      onToken
    })

    expect(result).toBe('I wanted to say hello')
    expect(onToken).toHaveBeenCalledWith('I wanted to ')
    expect(onToken).toHaveBeenCalledWith('say hello')
    expect(onToken).toHaveBeenCalledTimes(2)
  })

  it('includes appName in system prompt sent to Ollama', async () => {
    const lines = [JSON.stringify({ message: { content: 'ok' }, done: true })]

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      body: makeStreamBody(lines)
    } as any)

    await streamFormattedText({ rawTranscript: 'hello', appName: 'slack', onToken: vi.fn() })

    const callArgs = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(callArgs[1]!.body as string)
    const systemMsg = body.messages.find((m: any) => m.role === 'system')
    expect(systemMsg.content).toContain('slack')
  })

  it('throws helpful error when Ollama is not running', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(
      streamFormattedText({ rawTranscript: 'test', appName: 'test', onToken: vi.fn() })
    ).rejects.toThrow('Ollama is not running')
  })
})
