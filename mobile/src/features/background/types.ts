export type DegradationLevel = 'normal' | 'degraded' | 'severe';

export type BackgroundMonitorState = {
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: DegradationLevel | null;
  lastAvgRttMs: number | null;
  lastPacketLossPct: number | null;
  lastNotificationAt: string | null;
};

export type DegradationEvaluation = {
  level: DegradationLevel;
  reason: 'offline' | 'latency' | 'jitter' | 'loss' | 'multiple_unreachable' | null;
  avgRttMs: number | null;
  jitterMs: number | null;
  packetLossPct: number | null;
};
