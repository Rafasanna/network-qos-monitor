import {Platform} from 'react-native';

import NativeCellularInfo from './specs/NativeCellularInfo';
import {
  CellularInfo,
  CellularPlatform,
  normalizeCellularInfo,
} from './cellularInfoTypes';

function getSupportedPlatform(): CellularPlatform {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

export async function getCellularInfo(): Promise<CellularInfo> {
  const platform = getSupportedPlatform();

  if (!NativeCellularInfo) {
    return normalizeCellularInfo(null, platform);
  }

  try {
    const result = await NativeCellularInfo.getCellularInfo();
    return normalizeCellularInfo(result, platform);
  } catch {
    return normalizeCellularInfo(null, platform);
  }
}
