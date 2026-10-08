import TcpSocket from 'react-native-tcp-socket';

import {
  DEFAULT_PROBE_INTERVAL_MS,
  DEFAULT_PROBE_TARGETS,
  DEFAULT_PROBE_TIMEOUT_MS,
  DEFAULT_PROBES_PER_TARGET,
} from './config';
import {summarizeTarget} from './statistics';
import type {
  LatencySessionResult,
  MeasurementOptions,
  MeasurementProgress,
  MeasurementNetworkSnapshot,
  ProbeResult,
  ProbeTarget,
  TargetMeasurement,
} from './types';

const EMPTY_NETWORK_SNAPSHOT: MeasurementNetworkSnapshot = {
  connectionType: 'other',
  cellularGeneration: null,
  operator: null,
  signalDbm: null,
};

const now = (): number =>
  (globalThis as typeof globalThis & {performance: {now: () => number}})
    .performance.now();

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(new Error('AbortError'));
    };
    signal?.addEventListener('abort', abort, {once: true});
  });
}

function runProbe(
  target: ProbeTarget,
  attempt: number,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<ProbeResult> {
  return new Promise(resolve => {
    if (signal?.aborted) {
      resolve({attempt, success: false, rttMs: null, errorCode: 'CANCELLED'});
      return;
    }

    const startedAt = now();
    let settled = false;
    let socket: ReturnType<typeof TcpSocket.createConnection> | null = null;
    const timeout = setTimeout(() => finish(false, 'TIMEOUT'), timeoutMs);
    const onAbort = () => finish(false, 'CANCELLED');
    const cleanup = () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      if (socket) {
        socket.removeAllListeners();
        socket.destroy();
      }
    };
    const finish = (success: boolean, errorCode: string | null) => {
      if (settled) {
        return;
      }
      settled = true;
      const rttMs = success ? Math.max(0, now() - startedAt) : null;
      cleanup();
      if (__DEV__) {
        console.debug(
          `[qos] target=${target.id} probe=${attempt} ${success ? `rtt=${rttMs?.toFixed(1)}ms` : errorCode?.toLowerCase()}`,
        );
      }
      resolve({attempt, success, rttMs, errorCode});
    };

    signal?.addEventListener('abort', onAbort, {once: true});
    try {
      socket = TcpSocket.createConnection(
        {host: target.host, port: target.port, connectTimeout: timeoutMs},
        () => finish(true, null),
      );
      socket.on('error', error => {
        const code = (error as Error & {code?: string}).code;
        finish(false, code ?? 'CONNECTION_FAILED');
      });
    } catch {
      finish(false, 'CONNECTION_FAILED');
    }
  });
}

export async function runLatencySession(
  targets: ProbeTarget[] = DEFAULT_PROBE_TARGETS,
  options: MeasurementOptions = {},
): Promise<LatencySessionResult> {
  const probesPerTarget = Math.max(1, options.probesPerTarget ?? DEFAULT_PROBES_PER_TARGET);
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS);
  const intervalMs = Math.max(0, options.intervalMs ?? DEFAULT_PROBE_INTERVAL_MS);
  const startedAt = new Date().toISOString();
  const results: TargetMeasurement[] = [];
  const totalProbes = targets.length * probesPerTarget;
  let completedProbes = 0;

  for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
    const target = targets[targetIndex];
    const probes: ProbeResult[] = [];
    for (let attempt = 1; attempt <= probesPerTarget; attempt += 1) {
      if (options.signal?.aborted) {
        break;
      }
      options.onProgress?.({
        target,
        targetIndex,
        targetCount: targets.length,
        attempt,
        probesPerTarget,
        completedProbes,
        totalProbes,
      } satisfies MeasurementProgress);
      const probe = await runProbe(target, attempt, timeoutMs, options.signal);
      if (probe.errorCode === 'CANCELLED') {
        break;
      }
      probes.push(probe);
      completedProbes += 1;
      if (attempt < probesPerTarget && intervalMs > 0) {
        try {
          await wait(intervalMs, options.signal);
        } catch {
          break;
        }
      }
    }
    if (probes.length) {
      results.push(summarizeTarget(target, probes));
    }
    if (options.signal?.aborted) {
      break;
    }
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    targets: results,
    networkSnapshot: options.networkSnapshot ?? EMPTY_NETWORK_SNAPSHOT,
    cancelled: Boolean(options.signal?.aborted),
  };
}
