import {summarizeSession, summarizeTarget} from '../statistics';
import type {ProbeResult, ProbeTarget} from '../types';

const target: ProbeTarget = {
  id: 'sample',
  label: 'Sample',
  host: 'sample.example',
  port: 443,
};

function probe(attempt: number, rttMs: number | null): ProbeResult {
  return {
    attempt,
    success: rttMs !== null,
    rttMs,
    errorCode: rttMs === null ? 'TIMEOUT' : null,
  };
}

describe('summarizeTarget', () => {
  it('summarizes five successful RTTs and consecutive jitter', () => {
    const summary = summarizeTarget(target, [
      probe(1, 10),
      probe(2, 20),
      probe(3, 15),
      probe(4, 25),
      probe(5, 30),
    ]);

    expect(summary).toMatchObject({
      sent: 5,
      received: 5,
      lost: 0,
      packetLossPct: 0,
      minRttMs: 10,
      avgRttMs: 20,
      maxRttMs: 30,
      jitterMs: 7.5,
    });
  });

  it('counts failed probes as loss but excludes them from RTT statistics', () => {
    const summary = summarizeTarget(target, [
      probe(1, 20),
      probe(2, null),
      probe(3, 40),
      probe(4, null),
      probe(5, 30),
    ]);

    expect(summary).toMatchObject({
      sent: 5,
      received: 3,
      lost: 2,
      packetLossPct: 40,
      minRttMs: 20,
      avgRttMs: 30,
      maxRttMs: 40,
      jitterMs: 15,
    });
  });

  it('reports 100% loss with null RTT fields when every probe fails', () => {
    expect(summarizeTarget(target, [probe(1, null), probe(2, null)])).toMatchObject({
      sent: 2,
      received: 0,
      lost: 2,
      packetLossPct: 100,
      minRttMs: null,
      avgRttMs: null,
      maxRttMs: null,
      jitterMs: null,
    });
  });

  it('returns null jitter with one successful RTT', () => {
    expect(summarizeTarget(target, [probe(1, 12)])).toMatchObject({
      minRttMs: 12,
      avgRttMs: 12,
      maxRttMs: 12,
      jitterMs: null,
    });
  });

  it('returns null RTT statistics with zero valid probes', () => {
    expect(summarizeTarget(target, [])).toMatchObject({
      sent: 0,
      packetLossPct: 0,
      minRttMs: null,
      avgRttMs: null,
      maxRttMs: null,
      jitterMs: null,
    });
  });

  it('rounds metrics to one decimal place', () => {
    expect(summarizeTarget(target, [probe(1, 10.14), probe(2, 11.26)])).toMatchObject({
      avgRttMs: 10.7,
      jitterMs: 1.1,
      minRttMs: 10.1,
      maxRttMs: 11.3,
    });
  });
});

it('summarizes global values using target averages and all sent probes', () => {
  const first = summarizeTarget(target, [probe(1, 10), probe(2, null)]);
  const second = summarizeTarget({...target, id: 'second'}, [probe(1, 30), probe(2, 30)]);

  expect(summarizeSession([first, second])).toEqual({
    avgRttMs: 20,
    jitterMs: 0,
    packetLossPct: 25,
  });
});
