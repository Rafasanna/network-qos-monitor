import {summarizeSession} from '../measurements/statistics';
import type {TargetMeasurement} from '../measurements/types';
import type {DegradationEvaluation} from './types';

export const DEGRADATION_THRESHOLDS = {
  severeRttMs: 200,
  severeJitterMs: 80,
  severeLossPct: 10,
  severeUnreachableTargets: 2,
  degradedRttMs: 100,
  degradedJitterMs: 40,
  degradedLossPct: 3,
  notificationCooldownMs: 30 * 60 * 1000,
} as const;

export function evaluateDegradation(
  isConnected: boolean | null,
  targets: TargetMeasurement[],
): DegradationEvaluation {
  if (isConnected === false) {
    return {level: 'severe', reason: 'offline', avgRttMs: null, jitterMs: null, packetLossPct: null};
  }
  const summary = summarizeSession(targets);
  const {avgRttMs, jitterMs, packetLossPct} = summary;
  const unreachable = targets.filter(target => target.sent > 0 && target.received === 0).length;
  const base = {avgRttMs, jitterMs, packetLossPct: targets.length ? packetLossPct : null};
  if (targets.length === 0) {
    return {level: 'degraded', reason: null, ...base};
  }
  if (unreachable >= DEGRADATION_THRESHOLDS.severeUnreachableTargets) {
    return {level: 'severe', reason: 'multiple_unreachable', ...base};
  }
  if (packetLossPct >= DEGRADATION_THRESHOLDS.severeLossPct) {
    return {level: 'severe', reason: 'loss', ...base};
  }
  if (avgRttMs !== null && avgRttMs >= DEGRADATION_THRESHOLDS.severeRttMs) {
    return {level: 'severe', reason: 'latency', ...base};
  }
  if (jitterMs !== null && jitterMs >= DEGRADATION_THRESHOLDS.severeJitterMs) {
    return {level: 'severe', reason: 'jitter', ...base};
  }
  if (
    packetLossPct >= DEGRADATION_THRESHOLDS.degradedLossPct ||
    (avgRttMs !== null && avgRttMs >= DEGRADATION_THRESHOLDS.degradedRttMs) ||
    (jitterMs !== null && jitterMs >= DEGRADATION_THRESHOLDS.degradedJitterMs)
  ) {
    return {level: 'degraded', reason: null, ...base};
  }
  return {level: 'normal', reason: null, ...base};
}

export function shouldNotifySevere(
  evaluation: DegradationEvaluation,
  lastNotificationAt: string | null,
  nowMs: number,
): boolean {
  if (evaluation.level !== 'severe') {
    return false;
  }
  if (!lastNotificationAt) {
    return true;
  }
  const lastMs = Date.parse(lastNotificationAt);
  return Number.isFinite(lastMs) && nowMs - lastMs >= DEGRADATION_THRESHOLDS.notificationCooldownMs;
}
