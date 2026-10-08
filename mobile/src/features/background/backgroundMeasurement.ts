import {networkStatusService} from '../../services/networkStatusService';
import {tryAcquireMeasurement} from '../measurements/measurementMutex';
import {runLatencySession} from '../measurements/latencyEngine';
import {evaluateDegradation} from './degradationRules';
import type {DegradationEvaluation} from './types';

export const BACKGROUND_PROBES_PER_TARGET = 3;
export const BACKGROUND_PROBE_TIMEOUT_MS = 2000;
export const BACKGROUND_PROBE_INTERVAL_MS = 100;
export const BACKGROUND_TIME_BUDGET_MS = 25000;

export type BackgroundMeasurementResult =
  | {kind: 'completed'; evaluation: DegradationEvaluation}
  | {kind: 'skipped' | 'cancelled' | 'timeout'};

function refreshUntilAborted(signal: AbortSignal): Promise<Awaited<ReturnType<typeof networkStatusService.refresh>> | null> {
  return new Promise(resolve => {
    if (signal.aborted) {
      resolve(null);
      return;
    }
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      resolve(null);
    };
    signal.addEventListener('abort', onAbort, {once: true});
    networkStatusService.refresh().then(
      value => {signal.removeEventListener('abort', onAbort); resolve(value);},
      () => {signal.removeEventListener('abort', onAbort); resolve(null);},
    );
  });
}

export async function runBackgroundMeasurement(
  externalSignal?: AbortSignal,
): Promise<BackgroundMeasurementResult> {
  const release = tryAcquireMeasurement('background');
  if (!release) {
    return {kind: 'skipped'};
  }
  const controller = new AbortController();
  let timedOut = false;
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, {once: true});
  if (externalSignal?.aborted) {
    controller.abort();
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, BACKGROUND_TIME_BUDGET_MS);
  try {
    if (controller.signal.aborted) {
      return {kind: 'cancelled'};
    }
    const network = await refreshUntilAborted(controller.signal);
    if (controller.signal.aborted) {
      return {kind: timedOut ? 'timeout' : 'cancelled'};
    }
    if (!network) {
      return {kind: 'cancelled'};
    }
    if (network.isConnected === false) {
      return {kind: 'completed', evaluation: evaluateDegradation(false, [])};
    }
    const session = await runLatencySession(undefined, {
      probesPerTarget: BACKGROUND_PROBES_PER_TARGET,
      timeoutMs: BACKGROUND_PROBE_TIMEOUT_MS,
      intervalMs: BACKGROUND_PROBE_INTERVAL_MS,
      signal: controller.signal,
    });
    if (session.cancelled) {
      return {kind: timedOut ? 'timeout' : 'cancelled'};
    }
    return {kind: 'completed', evaluation: evaluateDegradation(network.isConnected, session.targets)};
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
    controller.abort();
    release();
  }
}
