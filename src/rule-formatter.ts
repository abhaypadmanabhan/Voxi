const FILLER_PATTERN = /\b(um+|uh+|er+|ah+|hmm+|like|you know|sort of|kind of|i mean|basically|actually|literally|right)\b[,.]?\s*/gi

const CODE_APPS = new Set(['terminal', 'code', 'cursor', 'vscode'])

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim()
}

function sentenceCase(text: string): string {
  if (!text) return text
  return text.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, pre, ch) => pre + ch.toUpperCase())
}

function ensureTrailingPunctuation(text: string, appName: string): string {
  if (!text) return text
  if (CODE_APPS.has(appName.toLowerCase())) return text
  const last = text.trim().slice(-1)
  if (/[.!?]/.test(last)) return text
  return text.trimEnd() + '.'
}

/**
 * Fast deterministic formatter for dictation. No LLM.
 * Typical runtime: <5ms for 200-word transcript.
 */
export function ruleFormat(params: {
  rawTranscript: string
  appName: string
}): string {
  let text = params.rawTranscript.trim()
  if (!text) return ''

  text = text.replace(FILLER_PATTERN, '')
  text = collapseWhitespace(text)
  text = sentenceCase(text)
  text = ensureTrailingPunctuation(text, params.appName)
  return text
}
