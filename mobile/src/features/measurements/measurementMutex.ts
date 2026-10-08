export type MeasurementOwner = 'manual' | 'background';

let currentOwner: MeasurementOwner | null = null;

export function tryAcquireMeasurement(owner: MeasurementOwner): (() => void) | null {
  if (currentOwner !== null) {
    return null;
  }
  currentOwner = owner;
  return () => {
    if (currentOwner === owner) {
      currentOwner = null;
    }
  };
}
