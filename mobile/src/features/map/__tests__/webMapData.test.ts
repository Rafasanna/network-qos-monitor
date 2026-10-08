import type {MapMeasurement} from '../../../storage/measurementRepository';
import {parseWebMapMessage, serializeWebMapPoints, toWebMapPoints} from '../webMapData';

const saved: MapMeasurement = {
  id: 'real-sqlite-id', startedAt: '2026-09-30T18:20:00Z',
  latitude: -31.42, longitude: -64.18,
  connectionType: 'cellular', cellularGeneration: '4G',
  globalAvgRttMs: 20, globalJitterMs: 2, globalPacketLossPct: 0,
  downloadMbps: 100, uploadMbps: 50,
};

describe('WebView map data', () => {
  it('transforms SQLite rows into point fields and quality heat weights', () => {
    const points = toWebMapPoints([saved, {...saved, id: 'bad', globalPacketLossPct: 20}]);
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({
      id: saved.id, latitude: saved.latitude, longitude: saved.longitude,
      startedAt: saved.startedAt, connectionType: saved.connectionType,
      cellularGeneration: saved.cellularGeneration, globalAvgRttMs: saved.globalAvgRttMs,
      globalJitterMs: saved.globalJitterMs, globalPacketLossPct: saved.globalPacketLossPct,
      downloadMbps: saved.downloadMbps, uploadMbps: saved.uploadMbps,
      qualityScore: 100, qualityCategory: 'Excelente', color: '#16A34A', heatWeight: 0.05,
    });
    expect(points[1].qualityScore).toBe(19);
    expect(points[1].heatWeight).toBeGreaterThan(0.7);
  });

  it('keeps an empty map empty and handles missing metrics and invalid coordinates', () => {
    expect(toWebMapPoints([])).toEqual([]);
    const withoutMetrics = toWebMapPoints([{
      ...saved, globalAvgRttMs: null, globalPacketLossPct: Number.NaN,
      downloadMbps: null, uploadMbps: null,
    }]);
    expect(withoutMetrics[0]).toMatchObject({
      qualityScore: null, qualityCategory: null, heatWeight: null, color: '#667085',
    });
    expect(toWebMapPoints([{...saved, latitude: Number.NaN}, {...saved, longitude: 181}])).toEqual([]);
  });

  it('escapes text before passing points to the WebView script', () => {
    const encoded = serializeWebMapPoints(toWebMapPoints([{...saved, id: '</script><script>alert(1)</script>'}]));
    expect(encoded).not.toContain('<');
    expect(JSON.parse(encoded)[0].id).toBe('</script><script>alert(1)</script>');
  });

  it('parses only known messages with valid IDs', () => {
    expect(parseWebMapMessage('{"type":"ready"}')).toEqual({type: 'ready'});
    expect(parseWebMapMessage('{"type":"tilesLoaded"}')).toEqual({type: 'tilesLoaded'});
    expect(parseWebMapMessage('{"type":"openDetail","id":"real-sqlite-id"}'))
      .toEqual({type: 'openDetail', id: 'real-sqlite-id'});
    expect(parseWebMapMessage('{"type":"openDetail","id":""}')).toBeNull();
    expect(parseWebMapMessage('{"type":"unknown"}')).toBeNull();
    expect(parseWebMapMessage('not json')).toBeNull();
  });
});
