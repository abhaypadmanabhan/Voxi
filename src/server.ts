import 'dotenv/config';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { z } from 'zod';
import { registerTranscribeWsRoute } from './ws-handler.js';
import { initMoonshine } from './asr.js';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
});

const parsedEnv = EnvSchema.safeParse(process.env);
if (!parsedEnv.success) {
  const errors = parsedEnv.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment configuration: ${errors.join('; ')}`);
}

const env = parsedEnv.data;

async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(websocket);
  await registerTranscribeWsRoute(app);

  app.get('/health', async () => ({ ok: true }));

  return app;
}

async function start(): Promise<void> {
  const app = await buildServer();

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`Voxi server listening on :${env.PORT}`);

  initMoonshine().catch(err => app.log.error('[asr] Moonshine warmup failed: ' + err));
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
