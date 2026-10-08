export type QualityInput = {
  globalAvgRttMs: number | null;
  globalPacketLossPct: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
};

type Threshold = readonly [value: number, score: number];

// Piecewise linear scales make boundaries explicit and avoid jumps near a threshold.
const LATENCY: readonly Threshold[] = [[0, 100], [30, 100], [60, 80], [100, 60], [200, 20], [400, 0]];
const LOSS: readonly Threshold[] = [[0, 100], [0.5, 80], [3, 60], [10, 20], [20, 0]];
const DOWNLOAD: readonly Threshold[] = [[0, 0], [2, 20], [10, 40], [25, 60], [50, 80], [100, 100]];
const UPLOAD: readonly Threshold[] = [[0, 0], [1, 20], [5, 40], [10, 60], [25, 80], [50, 100]];

export const QUALITY_COLORS = {
  Excelente: '#16A34A',
  Buena: '#84CC16',
  Regular: '#EAB308',
  Mala: '#F97316',
  'Muy mala': '#DC2626',
} as const;

export type QualityCategory = keyof typeof QUALITY_COLORS;

function valueScore(value: number | null, thresholds: readonly Threshold[]): number | null {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return null;
  }
  if (value <= thresholds[0][0]) {
    return thresholds[0][1];
  }
  for (let index = 1; index < thresholds.length; index += 1) {
    const [upperValue, upperScore] = thresholds[index];
    if (value <= upperValue) {
      const [lowerValue, lowerScore] = thresholds[index - 1];
      return lowerScore + (upperScore - lowerScore) *
        ((value - lowerValue) / (upperValue - lowerValue));
    }
  }
  return thresholds[thresholds.length - 1][1];
}

/** Academic visualization index. Missing metrics are excluded and weights are renormalized. */
export function calculateQualityScore(measurement: QualityInput): number | null {
  const values = [
    {score: valueScore(measurement.globalAvgRttMs, LATENCY), weight: 0.35},
    {score: valueScore(measurement.globalPacketLossPct, LOSS), weight: 0.30},
    {score: valueScore(measurement.downloadMbps, DOWNLOAD), weight: 0.20},
    {score: valueScore(measurement.uploadMbps, UPLOAD), weight: 0.15},
  ].filter((item): item is {score: number; weight: number} => item.score !== null);
  if (values.length === 0) {
    return null;
  }
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  let score = Math.round(values.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight);
  if ((measurement.globalPacketLossPct ?? 0) >= 20 || (measurement.globalAvgRttMs ?? 0) >= 400) {
    score = Math.min(score, 19);
  } else if ((measurement.globalPacketLossPct ?? 0) >= 10 || (measurement.globalAvgRttMs ?? 0) >= 200) {
    score = Math.min(score, 39);
  }
  return score;
}

export function getQualityCategory(score: number | null): QualityCategory | null {
  if (score === null || !Number.isFinite(score)) {
    return null;
  }
  if (score >= 80) return 'Excelente';
  if (score >= 60) return 'Buena';
  if (score >= 40) return 'Regular';
  if (score >= 20) return 'Mala';
  return 'Muy mala';
}
