import type {ProbeTarget} from './types';

export const DEFAULT_PROBES_PER_TARGET = 5;
export const DEFAULT_PROBE_TIMEOUT_MS = 3000;
export const DEFAULT_PROBE_INTERVAL_MS = 250;

// TCP/443 is broadly reachable; DNS resolution is naturally part of the first connect.
export const DEFAULT_PROBE_TARGETS: ProbeTarget[] = [
  {id: 'cloudflare', label: 'Cloudflare', host: 'one.one.one.one', port: 443},
  {id: 'google', label: 'Google', host: 'google.com', port: 443},
  {id: 'github', label: 'GitHub', host: 'github.com', port: 443},
];
