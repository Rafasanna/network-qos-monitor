import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export type CellularInfoSpec = {
  available: boolean;
  operator: string | null;
  radioTechnology: string | null;
  generation: string | null;
  signalDbm: number | null;
  signalLevel: number | null;
  isRoaming: boolean | null;
  platform: string;
};

export interface Spec extends TurboModule {
  getCellularInfo(): Promise<CellularInfoSpec>;
}

export default TurboModuleRegistry.get<Spec>('NativeCellularInfo');
