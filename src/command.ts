const OLLAMA_URL = 'http://localhost:11434/api/chat'

export interface CommandInput {
  instruction: string
  clipboardContent?: string
}

function buildPrompt(
  instruction: string,
  clipboardContent: string
): { system: string; user: string } {
  const lower = instruction.toLowerCase()

  if (lower.includes('summarize')) {
    return {
      system: 'You are a concise summarization assistant. Return ONLY the summary, no preamble.',
      user: `Summarize this concisely:\n\n${clipboardContent}`,
    }
  }
  if (lower.includes('make this professional') || lower.includes('professional')) {
    return {
      system: 'You are a professional writing assistant. Return ONLY the rewritten text.',
      user: `Rewrite the following in a professional tone:\n\n${clipboardContent}`,
    }
  }
  const translateMatch = lower.match(/translate to (.+)/)
  if (translateMatch) {
    const lang = translateMatch[1].trim()
    return {
      system: `You are a translation assistant. Translate to ${lang}. Return ONLY the translated text.`,
      user: clipboardContent,
    }
  }
  if (lower.includes('fix the code') || lower.includes('fix code')) {
    return {
      system: 'You are an expert programmer. Fix bugs in the code. Return ONLY the corrected code.',
      user: clipboardContent,
    }
  }
  if (lower.includes('shorter')) {
    return {
      system: 'You are a writing assistant. Rewrite more concisely. Return ONLY the shorter version.',
      user: clipboardContent,
    }
  }

  return {
    system: 'You are a helpful assistant. Return ONLY the result, no explanation.',
    user: `${instruction}\n\n${clipboardContent}`,
  }
}

export async function handleCommand(
  input: CommandInput,
  onToken: (token: string) => void
): Promise<string> {
  const content = input.clipboardContent ?? ''
  const { system, user } = buildPrompt(input.instruction, content)

  let response: Response
  try {
    response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma3',
        stream: true,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
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
          onToken(token)
        }
      } catch {
        // partial chunk, skip
      }
    }
  }

  return fullText
}
