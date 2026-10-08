import {
  BACKEND_BASE_URL,
  DOWNLOAD_BYTES,
  THROUGHPUT_TIMEOUT_MS,
  UPLOAD_BYTES,
} from '../../config/backend';

export type ThroughputPhase = 'download' | 'upload';

export type ThroughputTransfer = {
  bytes: number;
  durationMs: number;
  mbps: number;
};

export type ThroughputResult = {
  download: ThroughputTransfer | null;
  upload: ThroughputTransfer | null;
  error: string | null;
};

export type ThroughputTestOptions = {
  baseUrl?: string;
  downloadBytes?: number;
  uploadBytes?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onPhase?: (phase: ThroughputPhase) => void;
};

type HttpResponse = {
  status: number;
  body: unknown;
  contentLength: string | null;
  durationMs: number;
};

type HttpFailureCode =
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'HTTP_ERROR'
  | 'INVALID_RESPONSE';

class HttpFailure extends Error {
  constructor(readonly code: HttpFailureCode) {
    super(code);
    this.name = 'HttpFailure';
  }
}

const monotonicNow = (): number =>
  (globalThis as typeof globalThis & {performance: {now: () => number}})
    .performance.now();

function request(
  method: 'GET' | 'POST',
  url: string,
  body: ArrayBuffer | null,
  timeoutMs: number,
  signal?: AbortSignal,
  responseType: XMLHttpRequestResponseType = 'text',
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new HttpFailure('CANCELLED'));
      return;
    }

    const xhr = new XMLHttpRequest();
    let settled = false;
    let startedAt = 0;
    const finish = (error?: HttpFailure, response?: HttpResponse) => {
      if (settled) {
        return;
      }
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      xhr.onload = null;
      xhr.onerror = null;
      xhr.ontimeout = null;
      xhr.onabort = null;
      if (error) {
        reject(error);
      } else if (response) {
        resolve(response);
      } else {
        reject(new HttpFailure('INVALID_RESPONSE'));
      }
    };
    const onAbort = () => {
      try {
        xhr.abort();
      } finally {
        finish(new HttpFailure('CANCELLED'));
      }
    };

    xhr.open(method, url, true);
    xhr.timeout = timeoutMs;
    xhr.responseType = responseType;
    xhr.setRequestHeader('Cache-Control', 'no-cache, no-store');
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        finish(new HttpFailure('HTTP_ERROR'));
        return;
      }
      finish(undefined, {
        status: xhr.status,
        body: xhr.response,
        contentLength: xhr.getResponseHeader('Content-Length'),
        durationMs: Math.max(0, monotonicNow() - startedAt),
      });
    };
    xhr.onerror = () => finish(new HttpFailure('NETWORK_ERROR'));
    xhr.ontimeout = () => finish(new HttpFailure('TIMEOUT'));
    xhr.onabort = () => finish(new HttpFailure('CANCELLED'));
    signal?.addEventListener('abort', onAbort, {once: true});

    if (method === 'POST') {
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    }
    // This timestamp intentionally excludes payload generation and request setup.
    startedAt = monotonicNow();
    try {
      xhr.send(body);
    } catch {
      finish(new HttpFailure('NETWORK_ERROR'));
    }
  });
}

function bodyByteLength(body: unknown): number | null {
  if (body instanceof ArrayBuffer) {
    return body.byteLength;
  }
  if (ArrayBuffer.isView(body)) {
    return body.byteLength;
  }
  return null;
}

export function calculateMbps(bytes: number, durationMs: number): number | null {
  if (durationMs <= 0) {
    return null;
  }
  return (bytes * 8) / (durationMs / 1000) / 1_000_000;
}

function createUploadPayload(bytes: number): ArrayBuffer {
  const payload = new Uint8Array(bytes);
  payload.fill(0x5a);
  return payload.buffer;
}

let nonceSequence = 0;

function appendNonce(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  nonceSequence += 1;
  return `${url}${separator}_nonce=${Date.now()}-${nonceSequence}`;
}

function emptyResult(error: string): ThroughputResult {
  return {download: null, upload: null, error};
}

export async function runThroughputTest(
  options: ThroughputTestOptions = {},
): Promise<ThroughputResult> {
  const baseUrl = (options.baseUrl ?? BACKEND_BASE_URL).replace(/\/$/, '');
  const downloadBytes = options.downloadBytes ?? DOWNLOAD_BYTES;
  const uploadBytes = options.uploadBytes ?? UPLOAD_BYTES;
  const timeoutMs = options.timeoutMs ?? THROUGHPUT_TIMEOUT_MS;
  let download: ThroughputTransfer | null = null;
  let currentPhase: 'health' | ThroughputPhase = 'health';

  try {
    options.onPhase?.('download');
    const health = await request(
      'GET',
      `${baseUrl}/health`,
      null,
      timeoutMs,
      options.signal,
    );
    if (
      typeof health.body !== 'string' ||
      (JSON.parse(health.body) as {status?: unknown}).status !== 'ok'
    ) {
      return emptyResult('SERVER_UNAVAILABLE');
    }

    currentPhase = 'download';
    const downloadResponse = await request(
      'GET',
      appendNonce(`${baseUrl}/download?bytes=${downloadBytes}`),
      null,
      timeoutMs,
      options.signal,
      'arraybuffer',
    );
    const actualDownloadBytes = bodyByteLength(downloadResponse.body);
    if (actualDownloadBytes === null) {
      return emptyResult('DOWNLOAD_FAILED');
    }
    const expectedHeader = downloadResponse.contentLength
      ? Number(downloadResponse.contentLength)
      : null;
    if (
      actualDownloadBytes !== downloadBytes ||
      (expectedHeader !== null && expectedHeader !== actualDownloadBytes)
    ) {
      return emptyResult('DOWNLOAD_SIZE_MISMATCH');
    }
    const downloadMbps = calculateMbps(
      actualDownloadBytes,
      downloadResponse.durationMs,
    );
    if (downloadMbps === null) {
      return emptyResult('DOWNLOAD_FAILED');
    }
    download = {
      bytes: actualDownloadBytes,
      durationMs: downloadResponse.durationMs,
      mbps: downloadMbps,
    };

    if (options.signal?.aborted) {
      return {download, upload: null, error: 'CANCELLED'};
    }

    currentPhase = 'upload';
    options.onPhase?.('upload');
    const payload = createUploadPayload(uploadBytes);
    const uploadResponse = await request(
      'POST',
      `${baseUrl}/upload`,
      payload,
      timeoutMs,
      options.signal,
    );
    if (typeof uploadResponse.body !== 'string') {
      return {download, upload: null, error: 'UPLOAD_FAILED'};
    }
    let acknowledgment: {receivedBytes?: unknown};
    try {
      acknowledgment = JSON.parse(uploadResponse.body) as {
        receivedBytes?: unknown;
      };
    } catch {
      return {download, upload: null, error: 'UPLOAD_FAILED'};
    }
    if (acknowledgment.receivedBytes !== payload.byteLength) {
      return {download, upload: null, error: 'UPLOAD_SIZE_MISMATCH'};
    }
    const uploadMbps = calculateMbps(payload.byteLength, uploadResponse.durationMs);
    if (uploadMbps === null) {
      return {download, upload: null, error: 'UPLOAD_FAILED'};
    }
    return {
      download,
      upload: {
        bytes: payload.byteLength,
        durationMs: uploadResponse.durationMs,
        mbps: uploadMbps,
      },
      error: null,
    };
  } catch (error) {
    if (
      (error instanceof HttpFailure && error.code === 'CANCELLED') ||
      options.signal?.aborted
    ) {
      return {download, upload: null, error: 'CANCELLED'};
    }
    if (currentPhase === 'health') {
      return emptyResult('SERVER_UNAVAILABLE');
    }
    return {
      download,
      upload: null,
      error: currentPhase === 'download' ? 'DOWNLOAD_FAILED' : 'UPLOAD_FAILED',
    };
  }
}
