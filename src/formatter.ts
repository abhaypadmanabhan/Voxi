import Anthropic from '@anthropic-ai/sdk';

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  return new Anthropic({ apiKey });
}

export async function streamFormattedText(params: {
  rawTranscript: string;
  appName: string;
  onToken: (token: string) => void;
}): Promise<string> {
  const client = getAnthropicClient();
  const systemPrompt = [
    'You are a formatting assistant for Voxi voice dictation.',
    'Remove filler words (um, uh, like, you know), fix grammar, preserve',
    `the user's meaning and tone. App context: ${params.appName}.`,
    'Return ONLY the cleaned text. No explanation.'
  ].join(' ');

  const stream = client.messages.stream({
    model: 'claude-3-5-haiku-latest',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: params.rawTranscript
      }
    ]
  });

  let fullText = '';

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta' &&
      typeof event.delta.text === 'string'
    ) {
      fullText += event.delta.text;
      params.onToken(event.delta.text);
    }
  }

  await stream.finalMessage();
  return fullText;
}
