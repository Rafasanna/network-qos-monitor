import {
  calculateMbps,
  runThroughputTest,
  type ThroughputTestOptions,
} from '../throughputEngine';

type MockRequest = {
  status: number;
  response: unknown;
  responseType: string;
  timeout: number;
  onload: ((this: MockRequest, event: ProgressEvent) => void) | null;
  onerror: ((this: MockRequest, event: ProgressEvent) => void) | null;
  ontimeout: ((this: MockRequest, event: ProgressEvent) => void) | null;
  onabort: ((this: MockRequest, event: ProgressEvent) => void) | null;
  open: jest.Mock;
  setRequestHeader: jest.Mock;
  getResponseHeader: jest.Mock;
  send: jest.Mock;
  abort: jest.Mock;
  sentBody: unknown;
};

let requests: MockRequest[] = [];
let previousXhr: typeof XMLHttpRequest;

function installMockXhr(
  onSend: (request: MockRequest, body: unknown) => void,
): void {
  requests = [];
  const mockConstructor = jest.fn(() => {
    const request = {
      readyState: 0,
      status: 200,
      response: null,
      responseType: 'text',
      timeout: 0,
      onload: null,
      onerror: null,
      ontimeout: null,
      onabort: null,
      open: jest.fn(),
      setRequestHeader: jest.fn(),
      getResponseHeader: jest.fn(() => null),
      send: jest.fn(function (
        this: MockRequest,
        body: unknown,
      ) {
        this.sentBody = body;
        onSend(this, body);
      }),
      abort: jest.fn(function (this: MockRequest) {
        this.onabort?.call(this, {} as ProgressEvent);
      }),
      sentBody: null,
    } as unknown as MockRequest;
    requests.push(request);
    return request;
  });
  (globalThis as typeof globalThis & {XMLHttpRequest: typeof XMLHttpRequest})
    .XMLHttpRequest = mockConstructor as unknown as typeof XMLHttpRequest;
}

function finish(request: MockRequest): void {
  request.onload?.call(request, {} as ProgressEvent);
}

function successResponseHandler(
  uploadAckOverride?: number,
  downloadLength?: number,
): (request: MockRequest, body: unknown) => void {
  return (request, body) => {
    const [, url] = (request.open as jest.Mock).mock.calls[0] as [string, string];
    if (url.endsWith('/health')) {
      request.response = JSON.stringify({status: 'ok'});
    } else if (url.includes('/download?')) {
      const bytes = Number(new URL(url).searchParams.get('bytes'));
      request.response = new ArrayBuffer(downloadLength ?? bytes);
      (request.getResponseHeader as jest.Mock).mockReturnValue(
        String(downloadLength ?? bytes),
      );
    } else {
      const sentBytes = (body as ArrayBuffer).byteLength;
      request.response = JSON.stringify({
        receivedBytes: uploadAckOverride ?? sentBytes,
      });
    }
    setTimeout(() => finish(request), 1);
  };
}

describe('throughputEngine', () => {
  beforeEach(() => {
    previousXhr = globalThis.XMLHttpRequest;
  });

  afterEach(() => {
    (globalThis as typeof globalThis & {XMLHttpRequest: typeof XMLHttpRequest})
      .XMLHttpRequest = previousXhr;
  });

  it('uses decimal megabits per second rather than megabytes per second', () => {
    expect(calculateMbps(5_000_000, 2000)).toBe(20);
    expect(calculateMbps(5_000_000, 0)).toBeNull();
  });

  it('calculates Mbps from real byte count and elapsed milliseconds', async () => {
    installMockXhr(successResponseHandler());
    const result = await runThroughputTest({
      baseUrl: 'http://backend.test',
      downloadBytes: 16,
      uploadBytes: 8,
      timeoutMs: 1000,
    });

    expect(result.error).toBeNull();
    expect(result.download?.bytes).toBe(16);
    expect(result.download?.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.download?.mbps).toBeGreaterThanOrEqual(0);
    expect(result.upload?.bytes).toBe(8);
    expect(result.upload?.mbps).toBeGreaterThanOrEqual(0);
    expect(requests).toHaveLength(3);
    expect(requests[1].responseType).toBe('arraybuffer');
    expect(requests[1].setRequestHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-cache, no-store',
    );
  });

  it('returns a server-unavailable error when health fails and skips transfer', async () => {
    installMockXhr(request => {
      request.status = 503;
      finish(request);
    });
    const result = await runThroughputTest({baseUrl: 'http://backend.test'});
    expect(result).toEqual({download: null, upload: null, error: 'SERVER_UNAVAILABLE'});
    expect(requests).toHaveLength(1);
  });

  it('rejects a mismatched download byte count without starting upload', async () => {
    installMockXhr(successResponseHandler(undefined, 15));
    const result = await runThroughputTest({
      baseUrl: 'http://backend.test',
      downloadBytes: 16,
      uploadBytes: 8,
    });
    expect(result).toEqual({download: null, upload: null, error: 'DOWNLOAD_SIZE_MISMATCH'});
    expect(requests).toHaveLength(2);
  });

  it('keeps download result and reports a mismatched upload acknowledgment', async () => {
    installMockXhr(successResponseHandler(7));
    const result = await runThroughputTest({
      baseUrl: 'http://backend.test',
      downloadBytes: 16,
      uploadBytes: 8,
    });
    expect(result.download?.bytes).toBe(16);
    expect(result.upload).toBeNull();
    expect(result.error).toBe('UPLOAD_SIZE_MISMATCH');
  });

  it('aborts the active request and does not start download after cancelled health', async () => {
    installMockXhr(() => undefined);
    const controller = new AbortController();
    const options: ThroughputTestOptions = {
      baseUrl: 'http://backend.test',
      signal: controller.signal,
    };
    const resultPromise = runThroughputTest(options);
    controller.abort();
    const result = await resultPromise;
    expect(result.error).toBe('CANCELLED');
    expect(requests).toHaveLength(1);
  });

  it('normalizes network failures without exposing transport details', async () => {
    installMockXhr(request => request.onerror?.call(request, {} as ProgressEvent));
    const result = await runThroughputTest({baseUrl: 'http://backend.test'});
    expect(result.error).toBe('SERVER_UNAVAILABLE');
    expect(JSON.stringify(result)).not.toContain('stack');
  });
});
