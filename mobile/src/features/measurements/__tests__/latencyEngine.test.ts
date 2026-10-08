import TcpSocket from 'react-native-tcp-socket';

import {runLatencySession} from '../latencyEngine';
import type {ProbeTarget} from '../types';

const target: ProbeTarget = {
  id: 'local-test',
  label: 'Local test',
  host: '127.0.0.1',
  port: 1,
};

const createConnection = TcpSocket.createConnection as jest.Mock;

describe('runLatencySession socket lifecycle', () => {
  beforeEach(() => createConnection.mockReset());
  afterEach(() => jest.useRealTimers());

  it('destroys the socket immediately after a successful TCP connect', async () => {
    const socket = {
      on: jest.fn(),
      removeAllListeners: jest.fn(),
      destroy: jest.fn(),
    };
    createConnection.mockImplementation((_options, onConnect) => {
      Promise.resolve().then(onConnect);
      return socket;
    });

    const result = await runLatencySession([target], {
      probesPerTarget: 1,
      intervalMs: 0,
    });

    expect(createConnection).toHaveBeenCalledWith(
      expect.objectContaining({host: target.host, port: target.port}),
      expect.any(Function),
    );
    expect(socket.removeAllListeners).toHaveBeenCalledTimes(1);
    expect(socket.destroy).toHaveBeenCalledTimes(1);
    expect(result.targets[0].probes[0].success).toBe(true);
    expect(result.targets[0].probes[0].rttMs).not.toBeNull();
  });

  it('closes an active socket and excludes a cancelled probe from loss', async () => {
    jest.useFakeTimers();
    const socket = {
      on: jest.fn(),
      removeAllListeners: jest.fn(),
      destroy: jest.fn(),
    };
    createConnection.mockReturnValue(socket);
    const controller = new AbortController();
    const session = runLatencySession([target], {
      probesPerTarget: 3,
      intervalMs: 0,
      signal: controller.signal,
    });

    controller.abort();
    const result = await session;

    expect(socket.removeAllListeners).toHaveBeenCalledTimes(1);
    expect(socket.destroy).toHaveBeenCalledTimes(1);
    expect(result.cancelled).toBe(true);
    expect(result.targets).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
  });
});
