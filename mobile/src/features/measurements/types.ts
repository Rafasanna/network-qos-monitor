import type {ThroughputResult} from './throughputEngine';
import type {CellularGeneration, ConnectionType} from '../../types/network';

export type ProbeTarget = {
  id: string;
  label: string;
  host: string;
  port: number;
};

export type ProbeResult = {
  attempt: number;
  success: boolean;
  rttMs: number | null;
  errorCode: string | null;
};

export type TargetMeasurement = {
  target: ProbeTarget;
  probes: ProbeResult[];
  sent: number;
  received: number;
  lost: number;
  packetLossPct: number;
  minRttMs: number | null;
  avgRttMs: number | null;
  maxRttMs: number | null;
  jitterMs: number | null;
};

export type MeasurementNetworkSnapshot = {
  connectionType: ConnectionType;
  cellularGeneration: CellularGeneration | null;
  operator: string | null;
  signalDbm: number | null;
};

export type LatencySessionResult = {
  startedAt: string;
  finishedAt: string;
  targets: TargetMeasurement[];
  networkSnapshot: MeasurementNetworkSnapshot;
  cancelled: boolean;
};

export type MeasurementSessionResult = {
  startedAt: string;
  finishedAt: string;
  networkSnapshot: MeasurementNetworkSnapshot;
  latency: LatencySessionResult;
  throughput: ThroughputResult | null;
  cancelled: boolean;
};

export type MeasurementOptions = {
  probesPerTarget?: number;
  timeoutMs?: number;
  intervalMs?: number;
  signal?: AbortSignal;
  networkSnapshot?: MeasurementNetworkSnapshot;
  onProgress?: (progress: MeasurementProgress) => void;
};

export type MeasurementProgress = {
  target: ProbeTarget;
  targetIndex: number;
  targetCount: number;
  attempt: number;
  probesPerTarget: number;
  completedProbes: number;
  totalProbes: number;
};
