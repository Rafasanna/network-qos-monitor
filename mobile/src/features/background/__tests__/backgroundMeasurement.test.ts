import {networkStatusService} from '../../../services/networkStatusService';
import {runLatencySession} from '../../measurements/latencyEngine';
import {tryAcquireMeasurement} from '../../measurements/measurementMutex';
import {runBackgroundMeasurement} from '../backgroundMeasurement';
import {BACKGROUND_TIME_BUDGET_MS} from '../backgroundMeasurement';

jest.mock('../../measurements/latencyEngine', () => ({runLatencySession: jest.fn()}));

const latencyMock = runLatencySession as jest.MockedFunction<typeof runLatencySession>;

describe('background measurement', () => {
  beforeEach(() => {
    jest.spyOn(networkStatusService, 'refresh').mockResolvedValue({
      isConnected: true, isInternetReachable: true, connectionType: 'wifi',
      cellularGeneration: null, isConnectionExpensive: false, ipAddress: null,
    });
    latencyMock.mockReset();
  });
  afterEach(() => jest.restoreAllMocks());

  it('skips if manual measurement is active', async () => {
    const release = tryAcquireMeasurement('manual');
    expect(release).not.toBeNull();
    try {
      expect(await runBackgroundMeasurement()).toEqual({kind: 'skipped'});
      expect(latencyMock).not.toHaveBeenCalled();
    } finally { release?.(); }
  });

  it('does not open sockets when NetInfo reports offline', async () => {
    jest.spyOn(networkStatusService, 'refresh').mockResolvedValue({
      isConnected: false, isInternetReachable: false, connectionType: 'other',
      cellularGeneration: null, isConnectionExpensive: null, ipAddress: null,
    });
    const result = await runBackgroundMeasurement();
    expect(result.kind).toBe('completed');
    expect(latencyMock).not.toHaveBeenCalled();
  });

  it('cancels active latency and releases mutex', async () => {
    latencyMock.mockImplementation(async (_targets, options) => new Promise(resolve => {
      options?.signal?.addEventListener('abort', () => resolve({
        startedAt: '', finishedAt: '', targets: [], cancelled: true,
        networkSnapshot: {connectionType: 'other', cellularGeneration: null, operator: null, signalDbm: null},
      }), {once: true});
    }));
    const controller = new AbortController();
    const run = runBackgroundMeasurement(controller.signal);
    await Promise.resolve();
    controller.abort();
    expect(await run).toEqual({kind: 'cancelled'});
    const release = tryAcquireMeasurement('manual');
    expect(release).not.toBeNull();
    release?.();
  });

  it('ends on the global time budget and aborts active sockets', async () => {
    jest.useFakeTimers();
    latencyMock.mockImplementation(async (_targets, options) => new Promise(resolve => {
      options?.signal?.addEventListener('abort', () => resolve({
        startedAt: '', finishedAt: '', targets: [], cancelled: true,
        networkSnapshot: {connectionType: 'other', cellularGeneration: null, operator: null, signalDbm: null},
      }), {once: true});
    }));
    try {
      const run = runBackgroundMeasurement();
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(BACKGROUND_TIME_BUDGET_MS);
      expect(await run).toEqual({kind: 'timeout'});
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
