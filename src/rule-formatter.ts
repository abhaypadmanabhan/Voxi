const FILLER_PATTERN = /\b(um+|uh+|er+|ah+|hmm+|like|you know|sort of|kind of|i mean|basically|actually|literally|right)\b[,.]?\s*/gi

const CODE_APPS = new Set(['terminal', 'code', 'cursor', 'vscode'])

function applyCorrections(
  text: string,
  corrections: Array<{ raw: string; corrected: string }>
): string {
  let out = text
  for (const { raw, corrected } of corrections) {
    if (!raw) continue
    const re = new RegExp(`\\b${raw.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'gi')
    out = out.replace(re, corrected)
  }
  return out
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim()
}

function sentenceCase(text: string): string {
  if (!text) return text
  // Capitalize first char + first char after sentence terminators
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
  corrections?: Array<{ raw: string; corrected: string }>
}): string {
  let text = params.rawTranscript.trim()
  if (!text) return ''

  text = text.replace(FILLER_PATTERN, '')
  text = applyCorrections(text, params.corrections ?? [])
  text = collapseWhitespace(text)
  text = sentenceCase(text)
  text = ensureTrailingPunctuation(text, params.appName)
  return text
}
