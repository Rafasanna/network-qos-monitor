import assert from 'node:assert/strict';
import test from 'node:test';

import {buildServer} from '../server';

test('GET /health returns the health status', async () => {
  const app = buildServer();
  const response = await app.inject({method: 'GET', url: '/health'});
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {status: 'ok'});
  await app.close();
});

test('GET /download returns the bounded binary payload and no-cache headers', async () => {
  const app = buildServer({
    downloadDefaultBytes: 16,
    downloadMaxBytes: 64,
    uploadMaxBytes: 32,
  });
  const response = await app.inject({method: 'GET', url: '/download?bytes=23'});
  assert.equal(response.statusCode, 200);
  assert.equal(response.rawPayload.byteLength, 23);
  assert.equal(response.headers['content-type'], 'application/octet-stream');
  assert.equal(response.headers['content-length'], '23');
  assert.match(response.headers['cache-control'] ?? '', /no-store/);
  await app.close();
});

test('GET /download applies the configured default and rejects invalid/oversized sizes', async () => {
  const app = buildServer({
    downloadDefaultBytes: 16,
    downloadMaxBytes: 32,
    uploadMaxBytes: 32,
  });
  const defaultResponse = await app.inject({method: 'GET', url: '/download'});
  const oversizedResponse = await app.inject({method: 'GET', url: '/download?bytes=33'});
  const invalidResponse = await app.inject({method: 'GET', url: '/download?bytes=wat'});
  assert.equal(defaultResponse.rawPayload.byteLength, 16);
  assert.equal(oversizedResponse.statusCode, 400);
  assert.equal(invalidResponse.statusCode, 400);
  await app.close();
});

test('POST /upload reports actual received bytes and enforces the body limit', async () => {
  const app = buildServer({
    downloadDefaultBytes: 16,
    downloadMaxBytes: 32,
    uploadMaxBytes: 8,
  });
  const uploadResponse = await app.inject({
    method: 'POST',
    url: '/upload',
    headers: {'content-type': 'application/octet-stream'},
    payload: Buffer.from([1, 2, 3, 4, 5]),
  });
  const oversizedResponse = await app.inject({
    method: 'POST',
    url: '/upload',
    headers: {'content-type': 'application/octet-stream'},
    payload: Buffer.alloc(9),
  });
  assert.deepEqual(uploadResponse.json(), {receivedBytes: 5});
  assert.equal(oversizedResponse.statusCode, 413);
  await app.close();
});
