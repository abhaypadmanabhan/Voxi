const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

function ensureGroqKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY is not set');
  return key;
}

function pcm16ToWav(pcmBuffer: Buffer, sampleRate = 16000, channels = 1): Buffer {
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;

  const wav = Buffer.alloc(44 + dataSize);

  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);        // PCM
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(byteRate, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(bitsPerSample, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(wav, 44);

  return wav;
}

export async function transcribeAudio(base64Pcm: string): Promise<string> {
  const key = ensureGroqKey();
  const pcmBuffer = Buffer.from(base64Pcm, 'base64');
  const wavBuffer = pcm16ToWav(pcmBuffer);

  const formData = new FormData();
  formData.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'audio.wav');
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('language', 'en');
  formData.append('response_format', 'json');

  const response = await fetch(GROQ_TRANSCRIPTION_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Groq transcription failed (${response.status}): ${body}`);
  }

  const result = (await response.json()) as { text: string };
  return result.text.trim();
}
