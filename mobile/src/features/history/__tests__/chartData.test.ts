import type {ChartMeasurement} from '../../../storage/measurementRepository';
import {buildChartSeries} from '../chartData';

const row = (startedAt: string, globalAvgRttMs: number | null, downloadMbps: number | null): ChartMeasurement => ({
  startedAt, globalAvgRttMs, downloadMbps, uploadMbps: null,
  globalJitterMs: null, globalPacketLossPct: 0, connectionType: 'wifi',
});

describe('chart datasets', () => {
  it('returns no synthetic points for zero measurements', () => {
    expect(buildChartSeries([], 'globalAvgRttMs')).toEqual([]);
  });

  it('keeps one real timestamp and value', () => {
    const first = row('2026-09-30T18:20:00Z', 28, 50);
    expect(buildChartSeries([first], 'globalAvgRttMs')).toEqual([{
      timestampMs: Date.parse(first.startedAt), startedAt: first.startedAt, value: 28,
    }]);
  });

  it('sorts oldest to newest and skips null or invalid values', () => {
    const early = row('2026-09-29T18:20:00Z', 20, 30);
    const late = row('2026-09-30T18:20:00Z', 50, 60);
    const missing = row('2026-09-29T20:20:00Z', null, null);
    expect(buildChartSeries([late, missing, early], 'globalAvgRttMs').map(point => point.value)).toEqual([20, 50]);
    expect(buildChartSeries([late, missing, early], 'downloadMbps').map(point => point.value)).toEqual([30, 60]);
    expect(buildChartSeries([row('invalid', 12, 20)], 'globalAvgRttMs')).toEqual([]);
  });
});
