import type {ProbeResult, ProbeTarget, TargetMeasurement} from './types';

export function summarizeTarget(
  target: ProbeTarget,
  probes: ProbeResult[],
): TargetMeasurement {
  const successfulRtts = probes
    .filter((probe): probe is ProbeResult & {rttMs: number} =>
      probe.success && probe.rttMs !== null && Number.isFinite(probe.rttMs),
    )
    .map(probe => probe.rttMs);
  const sorted = [...successfulRtts].sort((a, b) => a - b);
  const jitterDeltas = successfulRtts.slice(1).map((rtt, index) =>
    Math.abs(rtt - successfulRtts[index]),
  );
  const sent = probes.length;
  const received = successfulRtts.length;
  const round = (value: number): number => Math.round(value * 10) / 10;

  return {
    target,
    probes,
    sent,
    received,
    lost: sent - received,
    packetLossPct: sent === 0 ? 0 : round(((sent - received) / sent) * 100),
    minRttMs: sorted.length ? round(sorted[0]) : null,
    avgRttMs: sorted.length
      ? round(successfulRtts.reduce((sum, rtt) => sum + rtt, 0) / received)
      : null,
    maxRttMs: sorted.length ? round(sorted[sorted.length - 1]) : null,
    jitterMs: jitterDeltas.length
      ? round(jitterDeltas.reduce((sum, delta) => sum + delta, 0) / jitterDeltas.length)
      : null,
  };
}

export function summarizeSession(measurements: TargetMeasurement[]) {
  const averages = measurements
    .map(measurement => measurement.avgRttMs)
    .filter((value): value is number => value !== null);
  const jitters = measurements
    .map(measurement => measurement.jitterMs)
    .filter((value): value is number => value !== null);
  const sent = measurements.reduce((sum, item) => sum + item.sent, 0);
  const lost = measurements.reduce((sum, item) => sum + item.lost, 0);
  const round = (value: number): number => Math.round(value * 10) / 10;

  return {
    avgRttMs: averages.length
      ? round(averages.reduce((sum, value) => sum + value, 0) / averages.length)
      : null,
    jitterMs: jitters.length
      ? round(jitters.reduce((sum, value) => sum + value, 0) / jitters.length)
      : null,
    packetLossPct: sent ? round((lost / sent) * 100) : 0,
  };
}
