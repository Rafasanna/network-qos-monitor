import type {CellularInfoSpec} from './specs/NativeCellularInfo';

export type CellularPlatform = 'android' | 'ios';
export type CellularGeneration = '2G' | '3G' | '4G' | '5G';

export type CellularInfo = {
  available: boolean;
  operator: string | null;
  radioTechnology: string | null;
  generation: CellularGeneration | null;
  signalDbm: number | null;
  signalLevel: number | null;
  isRoaming: boolean | null;
  platform: CellularPlatform;
};

export type CellularInfoPayload = Omit<CellularInfoSpec, 'platform'> & {
  platform?: string | null;
};

const androidTechnologyGeneration: Record<number, CellularGeneration> = {
  1: '2G', // GPRS
  2: '2G', // EDGE
  4: '2G', // CDMA
  7: '2G', // 1xRTT
  11: '2G', // iDEN
  16: '2G', // GSM
  3: '3G', // UMTS
  5: '3G', // EVDO_0
  6: '3G', // EVDO_A
  8: '3G', // HSDPA
  9: '3G', // HSUPA
  10: '3G', // HSPA
  12: '3G', // EVDO_B
  14: '3G', // EHRPD
  15: '3G', // HSPAP
  17: '3G', // TD_SCDMA
  13: '4G', // LTE
  19: '4G', // LTE_CA
  20: '5G', // NR
};

const androidTechnologyName: Record<number, string> = {
  1: 'GPRS',
  2: 'EDGE',
  3: 'UMTS',
  4: 'CDMA',
  5: 'EVDO_0',
  6: 'EVDO_A',
  7: '1xRTT',
  8: 'HSDPA',
  9: 'HSUPA',
  10: 'HSPA',
  11: 'iDEN',
  12: 'EVDO_B',
  13: 'LTE',
  14: 'EHRPD',
  15: 'HSPAP',
  16: 'GSM',
  17: 'TD_SCDMA',
  18: 'IWLAN',
  19: 'LTE_CA',
  20: 'NR',
};

const iosTechnologyGeneration: Record<string, CellularGeneration> = {
  CTRadioAccessTechnologyGPRS: '2G',
  CTRadioAccessTechnologyEdge: '2G',
  CTRadioAccessTechnologyCDMA1x: '2G',
  CTRadioAccessTechnologyWCDMA: '3G',
  CTRadioAccessTechnologyHSDPA: '3G',
  CTRadioAccessTechnologyHSUPA: '3G',
  CTRadioAccessTechnologyCDMAEVDORev0: '3G',
  CTRadioAccessTechnologyCDMAEVDORevA: '3G',
  CTRadioAccessTechnologyCDMAEVDORevB: '3G',
  CTRadioAccessTechnologyeHRPD: '3G',
  CTRadioAccessTechnologyLTE: '4G',
  CTRadioAccessTechnologyNRNSA: '5G',
  CTRadioAccessTechnologyNR: '5G',
};

export function mapAndroidNetworkTypeToGeneration(
  networkType: number | null,
): CellularGeneration | null {
  return networkType === null
    ? null
    : androidTechnologyGeneration[networkType] ?? null;
}

export function getAndroidRadioTechnologyName(
  networkType: number | null,
): string | null {
  return networkType === null ? null : androidTechnologyName[networkType] ?? null;
}

export function mapCoreTelephonyTechnologyToGeneration(
  technology: string | null,
): CellularGeneration | null {
  return technology === null ? null : iosTechnologyGeneration[technology] ?? null;
}

export function normalizeCellularInfo(
  value: CellularInfoPayload | null | undefined,
  platform: CellularPlatform,
): CellularInfo {
  const operator = value?.operator?.trim() || null;
  const radioTechnology = value?.radioTechnology?.trim() || null;
  const generation = value?.generation;
  const validGeneration =
    generation === '2G' ||
    generation === '3G' ||
    generation === '4G' ||
    generation === '5G'
      ? generation
      : null;
  const signalDbm =
    typeof value?.signalDbm === 'number' && Number.isFinite(value.signalDbm)
      ? value.signalDbm
      : null;
  const signalLevel =
    typeof value?.signalLevel === 'number' && Number.isFinite(value.signalLevel)
      ? value.signalLevel
      : null;
  const isRoaming =
    typeof value?.isRoaming === 'boolean' ? value.isRoaming : null;

  return {
    available: Boolean(
      value?.available &&
        (operator || radioTechnology || validGeneration || signalDbm !== null),
    ),
    operator,
    radioTechnology,
    generation: validGeneration,
    signalDbm,
    signalLevel,
    isRoaming,
    platform,
  };
}
