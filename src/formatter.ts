const OLLAMA_URL = 'http://localhost:11434/api/chat'

const APP_TONE: Record<string, string> = {
  slack: 'casual, conversational, use contractions',
  gmail: 'professional but friendly',
  mail: 'professional but friendly',
  outlook: 'formal professional tone',
  terminal: 'minimal formatting, raw text only',
  code: 'minimal formatting, technical precision',
  cursor: 'minimal formatting, technical precision',
  vscode: 'minimal formatting, technical precision',
}

function buildSystemPrompt(
  appName: string,
  corrections: Array<{ raw: string; corrected: string }>
): string {
  const tone = APP_TONE[appName.toLowerCase()] ?? 'neutral, clear tone'
  const fewShot =
    corrections.length > 0
      ? '\nLearned corrections from this user:\n' +
        corrections.map(c => `"${c.raw}" → "${c.corrected}"`).join('\n')
      : ''
  return [
    'You are a voice dictation formatter for Voxi.',
    '1. Remove filler words: um, uh, like, you know, sort of, kind of, right',
    '2. Fix grammar and sentence structure',
    '3. Detect list intent: if the user says "first... second...", "one... two...", "here are the steps", or enumerates items → format as a markdown bullet list',
    '4. Detect questions → preserve with proper punctuation',
    '5. Detect code mentions → format inline code with backticks',
    `6. Tone for "${appName}": ${tone}`,
    '7. Return ONLY the formatted text. No explanation, no preamble.',
    fewShot,
  ].join('\n')
}

export async function streamFormattedText(params: {
  rawTranscript: string
  appName: string
  corrections?: Array<{ raw: string; corrected: string }>
  onToken: (token: string) => void
}): Promise<string> {
  let response: Response
  try {
    response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma4:e4b',
        stream: true,
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(params.appName, params.corrections ?? []),
          },
          { role: 'user', content: params.rawTranscript },
        ],
      }),
    })
  } catch (err) {
    throw new Error(
      'Ollama is not running or unreachable. Start it with: ollama serve'
    )
  }

  if (!response.ok || !response.body) {
    throw new Error(`Ollama request failed: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const json = JSON.parse(line) as { message?: { content?: string }; done?: boolean }
        const token = json.message?.content ?? ''
        if (token) {
          fullText += token
          params.onToken(token)
        }
      } catch {
        // partial chunk, skip
      }
    }
  }

  return fullText
}
