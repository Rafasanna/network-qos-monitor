import {evaluateDegradation, shouldNotifySevere} from '../degradationRules';
import type {TargetMeasurement} from '../../measurements/types';

function target(avgRttMs: number | null, jitterMs: number | null, lost = 0, sent = 10): TargetMeasurement {
  return {
    target: {id: 'test', label: 'Test', host: 'example.org', port: 443},
    probes: [], sent, lost, received: sent - lost,
    packetLossPct: sent ? lost / sent * 100 : 0,
    minRttMs: avgRttMs, avgRttMs, maxRttMs: avgRttMs, jitterMs,
  };
}

describe('degradation rules', () => {
  it('keeps healthy RTT normal', () => expect(evaluateDegradation(true, [target(30, 5)]).level).toBe('normal'));
  it('classifies severe RTT', () => expect(evaluateDegradation(true, [target(200, 5)]).reason).toBe('latency'));
  it('classifies severe jitter', () => expect(evaluateDegradation(true, [target(30, 80)]).reason).toBe('jitter'));
  it('classifies severe packet loss', () => expect(evaluateDegradation(true, [target(30, 5, 1)]).reason).toBe('loss'));
  it('classifies no connection without probes', () => expect(evaluateDegradation(false, []).reason).toBe('offline'));
  it('classifies multiple unreachable targets', () => expect(evaluateDegradation(true, [target(null, null, 10), target(null, null, 10)]).reason).toBe('multiple_unreachable'));
  it('does not classify unknown connectivity and no targets as severe', () => expect(evaluateDegradation(null, []).level).toBe('degraded'));
  it('applies a persisted 30-minute cooldown', () => {
    const severe = evaluateDegradation(false, []);
    const now = Date.parse('2026-09-30T18:30:00.000Z');
    expect(shouldNotifySevere(severe, null, now)).toBe(true);
    expect(shouldNotifySevere(severe, '2026-09-30T18:10:00.000Z', now)).toBe(false);
    expect(shouldNotifySevere(severe, '2026-09-30T18:00:00.000Z', now)).toBe(true);
    expect(shouldNotifySevere(evaluateDegradation(true, [target(20, 2)]), null, now)).toBe(false);
  });
});
