import {useSyncExternalStore} from 'react';

import {networkStatusService} from '../../services/networkStatusService';
import {NetworkStatus} from '../../types/network';

export function useNetworkStatus(): NetworkStatus {
  return useSyncExternalStore(
    networkStatusService.subscribe,
    networkStatusService.getSnapshot,
    networkStatusService.getSnapshot,
  );
}

export const refreshNetworkStatus = networkStatusService.refresh;
