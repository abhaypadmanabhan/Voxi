const DEFAULT_CREATE_URL =
  process.env.MINIMAX_STT_CREATE_URL ?? 'https://api.minimax.io/v1/stt/create';
const DEFAULT_POLL_TIMEOUT_MS = 60_000;
const DEFAULT_POLL_INTERVAL_MS = 1_000;

interface MiniMaxCreateResult {
  taskId?: string;
  pollUrl?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureMinimaxKey(): string {
  const key = process.env.MINIMAX_API_KEY;
  if (!key) {
    throw new Error('MINIMAX_API_KEY is not set');
  }
  return key;
}

function extractTaskId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const source = payload as Record<string, unknown>;
  const directCandidates = ['task_id', 'taskId', 'job_id', 'jobId', 'id'];
  for (const key of directCandidates) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  const nestedCandidates = ['data', 'result'];
  for (const container of nestedCandidates) {
    const nested = source[container];
    if (nested && typeof nested === 'object') {
      const nestedTaskId = extractTaskId(nested);
      if (nestedTaskId) {
        return nestedTaskId;
      }
    }
  }

  return undefined;
}

function extractPollUrl(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const source = payload as Record<string, unknown>;
  const candidates = ['poll_url', 'pollUrl', 'status_url', 'statusUrl'];
  for (const key of candidates) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  const nested = source.data;
  if (nested && typeof nested === 'object') {
    const nestedPollUrl = extractPollUrl(nested);
    if (nestedPollUrl) {
      return nestedPollUrl;
    }
  }

  return undefined;
}

function extractCreateResult(payload: unknown): MiniMaxCreateResult {
  return {
    taskId: extractTaskId(payload),
    pollUrl: extractPollUrl(payload)
  };
}

function normalizeStatus(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return 'unknown';
  }

  const source = payload as Record<string, unknown>;
  const keys = ['status', 'state'];

  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string') {
      return value.toLowerCase();
    }
  }

  if (source.data && typeof source.data === 'object') {
    return normalizeStatus(source.data);
  }

  return 'unknown';
}

function extractTranscript(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const source = payload as Record<string, unknown>;
  const directText = ['text', 'transcript'];
  for (const key of directText) {
    const value = source[key];
    if (typeof value === 'string') {
      return value;
    }
  }

  const result = source.result;
  if (result && typeof result === 'object') {
    const nested = extractTranscript(result);
    if (nested) {
      return nested;
    }
  }

  const data = source.data;
  if (data && typeof data === 'object') {
    const nested = extractTranscript(data);
    if (nested) {
      return nested;
    }
  }

  const segments = source.segments;
  if (Array.isArray(segments)) {
    const joined = segments
      .map((seg) => {
        if (seg && typeof seg === 'object') {
          const text = (seg as Record<string, unknown>).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .filter(Boolean)
      .join(' ')
      .trim();

    if (joined) {
      return joined;
    }
  }

  return '';
}

function resolvePollUrl(createUrl: string, taskId: string, payloadPollUrl?: string): string {
  const envPollUrl = process.env.MINIMAX_STT_POLL_URL;
  if (envPollUrl && envPollUrl.trim().length > 0) {
    return envPollUrl.includes('{taskId}')
      ? envPollUrl.replace('{taskId}', encodeURIComponent(taskId))
      : envPollUrl;
  }

  if (payloadPollUrl) {
    return payloadPollUrl;
  }

  if (createUrl.endsWith('/create')) {
    return `${createUrl.replace(/\/create$/, '/query')}?task_id=${encodeURIComponent(taskId)}`;
  }

  return `${createUrl}?task_id=${encodeURIComponent(taskId)}`;
}

async function createJob(base64Pcm: string, minimaxKey: string): Promise<MiniMaxCreateResult> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(DEFAULT_CREATE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${minimaxKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio: base64Pcm,
        language: 'en'
      })
    });

    if (response.status === 429 && attempt === 0) {
      await sleep(1_000);
      continue;
    }

    if (!response.ok) {
      const body = await response.text();
      lastError = new Error(`MiniMax create failed (${response.status}): ${body}`);
      break;
    }

    const payload = (await response.json()) as unknown;
    return extractCreateResult(payload);
  }

  throw lastError ?? new Error('MiniMax create failed');
}

export async function transcribeWithMiniMax(base64Pcm: string): Promise<string> {
  const minimaxKey = ensureMinimaxKey();
  const createResult = await createJob(base64Pcm, minimaxKey);

  if (!createResult.taskId) {
    throw new Error('MiniMax create response did not contain a task id');
  }

  const pollUrl = resolvePollUrl(DEFAULT_CREATE_URL, createResult.taskId, createResult.pollUrl);
  const deadline = Date.now() + DEFAULT_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const response = await fetch(pollUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${minimaxKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`MiniMax polling failed (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as unknown;
    const status = normalizeStatus(payload);

    if (['done', 'completed', 'succeeded', 'success'].includes(status)) {
      return extractTranscript(payload);
    }

    if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
      throw new Error(`MiniMax job failed with status: ${status}`);
    }

    await sleep(DEFAULT_POLL_INTERVAL_MS);
  }

  throw new Error('MiniMax polling timed out after 60s');
}
