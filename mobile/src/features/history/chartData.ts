import type {ChartMeasurement} from '../../storage/measurementRepository';

export type ChartMetric =
  | 'globalAvgRttMs' | 'downloadMbps' | 'uploadMbps'
  | 'globalJitterMs' | 'globalPacketLossPct';

export type ChartPoint = {timestampMs: number; value: number; startedAt: string};

export function buildChartSeries(
  measurements: readonly ChartMeasurement[],
  metric: ChartMetric,
): ChartPoint[] {
  return measurements
    .map(item => ({
      timestampMs: Date.parse(item.startedAt),
      startedAt: item.startedAt,
      value: item[metric],
    }))
    .filter((item): item is ChartPoint =>
      item.value !== null && Number.isFinite(item.value) &&
      item.value >= 0 && Number.isFinite(item.timestampMs),
    )
    .sort((left, right) => left.timestampMs - right.timestampMs);
}
