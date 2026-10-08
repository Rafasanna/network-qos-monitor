export type ConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'other';

export type CellularGeneration = '2G' | '3G' | '4G' | '5G';

export type NetworkStatus = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  connectionType: ConnectionType;
  cellularGeneration: CellularGeneration | null;
  isConnectionExpensive: boolean | null;
  ipAddress: string | null;
};
