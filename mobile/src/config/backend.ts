import {Platform} from 'react-native';

declare const process: {env: {QOS_BACKEND_URL?: string}};

// Metro replaces this one development-only variable at bundle time. No personal IP is stored.
const localOverride = process.env.QOS_BACKEND_URL?.trim();

// Simulator defaults remain unchanged when no override is supplied.
export const BACKEND_BASE_URL =
  localOverride || (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

export const DOWNLOAD_BYTES = 5_000_000;
export const UPLOAD_BYTES = 2_000_000;
export const THROUGHPUT_TIMEOUT_MS = 30_000;
