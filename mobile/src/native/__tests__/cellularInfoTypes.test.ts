import {
  mapAndroidNetworkTypeToGeneration,
  mapCoreTelephonyTechnologyToGeneration,
  normalizeCellularInfo,
} from '../cellularInfoTypes';

describe('cellular technology mappings', () => {
  test.each([
    [1, '2G'],
    [13, '4G'],
    [19, '4G'],
    [20, '5G'],
    [0, null],
    [null, null],
  ] as const)('maps Android network type %s', (networkType, generation) => {
    expect(mapAndroidNetworkTypeToGeneration(networkType)).toBe(generation);
  });

  test.each([
    ['CTRadioAccessTechnologyGPRS', '2G'],
    ['CTRadioAccessTechnologyHSDPA', '3G'],
    ['CTRadioAccessTechnologyLTE', '4G'],
    ['CTRadioAccessTechnologyNRNSA', '5G'],
    ['unknown', null],
    [null, null],
  ] as const)('maps CoreTelephony technology %s', (technology, generation) => {
    expect(mapCoreTelephonyTechnologyToGeneration(technology)).toBe(generation);
  });
});

describe('cellular info normalization', () => {
  test('returns a safe unavailable value when native fields are missing', () => {
    expect(normalizeCellularInfo(null, 'ios')).toEqual({
      available: false,
      operator: null,
      radioTechnology: null,
      generation: null,
      signalDbm: null,
      signalLevel: null,
      isRoaming: null,
      platform: 'ios',
    });
  });

  test('cleans optional values and rejects invalid numeric readings', () => {
    expect(
      normalizeCellularInfo(
        {
          available: true,
          operator: '  ',
          radioTechnology: ' LTE ',
          generation: '9G',
          signalDbm: Number.NaN,
          signalLevel: null,
          isRoaming: null,
        },
        'android',
      ),
    ).toEqual({
      available: true,
      operator: null,
      radioTechnology: 'LTE',
      generation: null,
      signalDbm: null,
      signalLevel: null,
      isRoaming: null,
      platform: 'android',
    });
  });
});
