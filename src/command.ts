import Anthropic from '@anthropic-ai/sdk';

export interface CommandInput {
  instruction: string;
  clipboardContent?: string;
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  return new Anthropic({ apiKey });
}

function buildPrompt(instruction: string, clipboardContent: string): { system: string; user: string } {
  const lower = instruction.toLowerCase();

  if (lower.includes('summarize')) {
    return {
      system: 'You are a concise summarization assistant. Return ONLY the summary, no preamble.',
      user: `Summarize this concisely:\n\n${clipboardContent}`
    };
  }
  if (lower.includes('make this professional') || lower.includes('professional')) {
    return {
      system: 'You are a professional writing assistant. Return ONLY the rewritten text.',
      user: `Rewrite the following in a professional tone:\n\n${clipboardContent}`
    };
  }
  const translateMatch = lower.match(/translate to (.+)/);
  if (translateMatch) {
    const lang = translateMatch[1].trim();
    return {
      system: `You are a translation assistant. Translate to ${lang}. Return ONLY the translated text.`,
      user: clipboardContent
    };
  }
  if (lower.includes('fix the code') || lower.includes('fix code')) {
    return {
      system: 'You are an expert programmer. Fix bugs in the code. Return ONLY the corrected code.',
      user: clipboardContent
    };
  }
  if (lower.includes('shorter')) {
    return {
      system: 'You are a writing assistant. Rewrite more concisely. Return ONLY the shorter version.',
      user: clipboardContent
    };
  }

  // Fallback: treat instruction as a general prompt
  return {
    system: 'You are a helpful assistant. Return ONLY the result, no explanation.',
    user: `${instruction}\n\n${clipboardContent}`
  };
}

export async function handleCommand(
  input: CommandInput,
  onToken: (token: string) => void
): Promise<string> {
  const content = input.clipboardContent ?? '';
  const { system, user } = buildPrompt(input.instruction, content);
  const client = getClient();

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: user }]
  });

  let fullText = '';
  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta' &&
      typeof event.delta.text === 'string'
    ) {
      fullText += event.delta.text;
      onToken(event.delta.text);
    }
  }

  await stream.finalMessage();
  return fullText;
}
