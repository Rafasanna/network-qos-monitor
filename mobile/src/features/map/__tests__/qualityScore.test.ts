import {calculateQualityScore, getQualityCategory} from '../qualityScore';
import type {QualityInput} from '../qualityScore';

const withLatency = (globalAvgRttMs: number): QualityInput => ({
  globalAvgRttMs, globalPacketLossPct: null, downloadMbps: null, uploadMbps: null,
});

describe('academic quality score', () => {
  it.each([
    [20, 100, 'Excelente'],
    [80, 70, 'Buena'],
    [140, 44, 'Regular'],
    [180, 28, 'Mala'],
    [300, 10, 'Muy mala'],
  ] as const)('maps %i ms to %i and %s', (latency, expected, category) => {
    const score = calculateQualityScore(withLatency(latency));
    expect(score).toBe(expected);
    expect(getQualityCategory(score)).toBe(category);
  });

  it('renormalizes available metrics and leaves all unavailable as null', () => {
    expect(calculateQualityScore({globalAvgRttMs: null, globalPacketLossPct: null, downloadMbps: null, uploadMbps: null})).toBeNull();
    expect(getQualityCategory(null)).toBeNull();
    expect(calculateQualityScore({globalAvgRttMs: 30, globalPacketLossPct: null, downloadMbps: null, uploadMbps: null})).toBe(100);
  });

  it('keeps severe loss and latency from being hidden by fast throughput', () => {
    const otherwiseExcellent = {globalAvgRttMs: 20, globalPacketLossPct: 0, downloadMbps: 100, uploadMbps: 50};
    expect(calculateQualityScore(otherwiseExcellent)).toBe(100);
    expect(calculateQualityScore({...otherwiseExcellent, globalPacketLossPct: 10})).toBeLessThanOrEqual(39);
    expect(calculateQualityScore({...otherwiseExcellent, globalPacketLossPct: 20})).toBeLessThanOrEqual(19);
    expect(calculateQualityScore({...otherwiseExcellent, globalAvgRttMs: 400})).toBeLessThanOrEqual(19);
  });

  it('accounts for low download and clamps extreme inputs', () => {
    const base = {globalAvgRttMs: 30, globalPacketLossPct: 0, downloadMbps: 100, uploadMbps: 50};
    expect(calculateQualityScore({...base, downloadMbps: 1})).toBeLessThan(calculateQualityScore(base)!);
    expect(calculateQualityScore(withLatency(9999))).toBe(0);
    expect(calculateQualityScore({...base, downloadMbps: Number.NaN})).toBe(100);
    expect(calculateQualityScore({...base, globalPacketLossPct: -1})).toBe(100);
  });
});
