import NetInfo, {type NetInfoState} from '@react-native-community/netinfo';

import {
  CellularGeneration,
  ConnectionType,
  NetworkStatus,
} from '../types/network';

type Subscriber = () => void;

const initialStatus: NetworkStatus = {
  isConnected: null,
  isInternetReachable: null,
  connectionType: 'other',
  cellularGeneration: null,
  isConnectionExpensive: null,
  ipAddress: null,
};

const connectionTypes: Partial<Record<NetInfoState['type'], ConnectionType>> = {
  wifi: 'wifi',
  cellular: 'cellular',
  ethernet: 'ethernet',
};

const cellularGenerations: Record<string, CellularGeneration> = {
  '2g': '2G',
  '3g': '3G',
  '4g': '4G',
  '5g': '5G',
};

function normalizeState(state: NetInfoState): NetworkStatus {
  const connectionType = connectionTypes[state.type] ?? 'other';

  let cellularGeneration: CellularGeneration | null = null;
  if (
    state.type === 'cellular' &&
    state.details.cellularGeneration
  ) {
    cellularGeneration = cellularGenerations[state.details.cellularGeneration];
  }

  let ipAddress: string | null = null;
  if (
    state.type === 'wifi' ||
    state.type === 'ethernet'
  ) {
    ipAddress = state.details.ipAddress;
  }

  return {
    isConnected: state.isConnected,
    isInternetReachable: state.isInternetReachable,
    connectionType,
    cellularGeneration,
    isConnectionExpensive: state.details?.isConnectionExpensive ?? null,
    ipAddress,
  };
}

class NetworkStatusService {
  private snapshot = initialStatus;
  private subscribers = new Set<Subscriber>();
  private unsubscribeFromNetInfo: (() => void) | null = null;

  getSnapshot = (): NetworkStatus => this.snapshot;

  refresh = async (): Promise<NetworkStatus> => {
    try {
      const state = await NetInfo.fetch();
      this.snapshot = normalizeState(state);
      this.subscribers.forEach(currentSubscriber => currentSubscriber());
    } catch {
      // Keep the last known value when the platform cannot refresh connectivity.
    }

    return this.snapshot;
  };

  subscribe = (subscriber: Subscriber): (() => void) => {
    this.subscribers.add(subscriber);

    if (!this.unsubscribeFromNetInfo) {
      this.unsubscribeFromNetInfo = NetInfo.addEventListener(state => {
        this.snapshot = normalizeState(state);
        this.subscribers.forEach(currentSubscriber => currentSubscriber());
      });
    }

    return () => {
      this.subscribers.delete(subscriber);

      if (this.subscribers.size === 0 && this.unsubscribeFromNetInfo) {
        this.unsubscribeFromNetInfo();
        this.unsubscribeFromNetInfo = null;
      }
    };
  };
}

export const networkStatusService = new NetworkStatusService();
