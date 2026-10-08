import type {MapMeasurement} from '../../../storage/measurementRepository';
import {measurementToHeatmapPoint, measurementToMarkerModel, regionForMeasurements} from '../mapData';

const measured: MapMeasurement = {
  id: 'one', startedAt: '2026-09-30T18:20:00Z', latitude: -31.42, longitude: -64.18,
  connectionType: 'cellular', cellularGeneration: '4G', globalAvgRttMs: 20,
  globalJitterMs: 2, globalPacketLossPct: 0, downloadMbps: 100, uploadMbps: 50,
};

describe('map models', () => {
  it('keeps real coordinates and presents quality text and color on markers', () => {
    expect(measurementToMarkerModel(measured)).toMatchObject({
      id: 'one', latitude: -31.42, longitude: -64.18,
      score: 100, category: 'Excelente', color: '#16A34A',
    });
  });

  it('derives relative heatmap severity and omits unavailable metrics', () => {
    expect(measurementToHeatmapPoint(measured)).toEqual({latitude: -31.42, longitude: -64.18, weight: 0.05});
    expect(measurementToHeatmapPoint({...measured, globalPacketLossPct: 20})!.weight).toBeGreaterThan(0.7);
    expect(measurementToHeatmapPoint({...measured, globalAvgRttMs: null}, 'latency')).toBeNull();
    expect(measurementToHeatmapPoint({...measured, downloadMbps: null}, 'download')).toBeNull();
    expect(measurementToHeatmapPoint({...measured, downloadMbps: 0}, 'download')!.weight).toBe(1);
  });

  it('uses saved coordinates to derive a viewport and handles an empty map', () => {
    expect(regionForMeasurements([])).toBeNull();
    expect(regionForMeasurements([measured])).toMatchObject({latitude: -31.42, longitude: -64.18});
    const region = regionForMeasurements([measured, {...measured, id: 'two', latitude: -32, longitude: -65}]);
    expect(region!.latitudeDelta).toBeGreaterThan(0.5);
    expect(region!.longitudeDelta).toBeGreaterThan(0.8);
  });
});
