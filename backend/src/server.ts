import 'dotenv/config';

import Fastify, {type FastifyInstance} from 'fastify';

export type ServerConfig = {
  downloadDefaultBytes: number;
  downloadMaxBytes: number;
  uploadMaxBytes: number;
};

const defaultConfig: ServerConfig = {
  downloadDefaultBytes: positiveEnv('DOWNLOAD_DEFAULT_BYTES', 5_000_000),
  downloadMaxBytes: positiveEnv('DOWNLOAD_MAX_BYTES', 20_000_000),
  uploadMaxBytes: positiveEnv('UPLOAD_MAX_BYTES', 5_000_000),
};

function positiveEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export function buildServer(
  config: ServerConfig = defaultConfig,
): FastifyInstance {
  const app = Fastify({logger: process.env.NODE_ENV !== 'test'});

  app.addContentTypeParser(
    'application/octet-stream',
    {parseAs: 'buffer', bodyLimit: config.uploadMaxBytes},
    (_request, body, done) => done(null, body),
  );

  app.get('/health', async () => ({status: 'ok'}));

  app.get<{Querystring: {bytes?: string}}>('/download', async (request, reply) => {
    const requested = request.query.bytes === undefined
      ? config.downloadDefaultBytes
      : Number(request.query.bytes);
    if (
      !Number.isSafeInteger(requested) ||
      requested <= 0 ||
      requested > config.downloadMaxBytes
    ) {
      return reply.code(400).send({
        error: 'INVALID_BYTES',
        maxBytes: config.downloadMaxBytes,
      });
    }

    // Only one bounded in-memory payload is created per request; no test file is written.
    const payload = Buffer.alloc(requested, 0x5a);
    return reply
      .header('Content-Type', 'application/octet-stream')
      .header('Content-Length', String(payload.byteLength))
      .header('Cache-Control', 'no-store, no-cache, must-revalidate')
      .header('Pragma', 'no-cache')
      .header('Expires', '0')
      .send(payload);
  });

  app.post('/upload', async (request, reply) => {
    if (!Buffer.isBuffer(request.body)) {
      return reply.code(415).send({error: 'EXPECTED_OCTET_STREAM'});
    }
    return reply.send({receivedBytes: request.body.byteLength});
  });

  return app;
}

export async function startServer(): Promise<void> {
  const app = buildServer();
  const port = positiveEnv('PORT', 3000);
  const host = process.env.HOST?.trim() || '0.0.0.0';
  await app.listen({port, host});
  app.log.info(`Throughput test backend listening on http://${host}:${port}`);
}

if (require.main === module) {
  startServer().catch(error => {
    console.error('Could not start throughput backend', error);
    process.exitCode = 1;
  });
}
