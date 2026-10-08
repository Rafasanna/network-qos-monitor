import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import {getMeasurementsForExport} from '../../../storage/measurementRepository';
import {shareMeasurements} from '../exportService';

jest.mock('../../../storage/measurementRepository', () => ({getMeasurementsForExport: jest.fn()}));

const fixture = {
  id: 'real-id', startedAt: '2026-09-30T18:00:00.000Z', finishedAt: '2026-09-30T18:01:00.000Z',
  latitude: -31.42, longitude: -64.18, locationAccuracyM: 10,
  locationTimestamp: '2026-09-30T18:01:00.000Z', connectionType: 'wifi',
  cellularGeneration: null, operator: null, signalDbm: null,
  globalAvgRttMs: 25, globalJitterMs: 3, globalPacketLossPct: 0,
  downloadMbps: 50, uploadMbps: 10, targets: [],
};

describe('export service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getMeasurementsForExport as jest.Mock).mockResolvedValue([fixture]);
  });

  it('writes a local file then opens native share sheet for selected IDs', async () => {
    await shareMeasurements('json', ['real-id']);
    expect(getMeasurementsForExport).toHaveBeenCalledWith(['real-id']);
    expect(ReactNativeBlobUtil.fs.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/^\/tmp\/network-qos-\d{4}-\d{2}-\d{2}-\d{4}\.json$/),
      expect.stringContaining('"measurementCount": 1'), 'utf8',
    );
    expect(Share.open).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringMatching(/^file:\/\/\/tmp\/network-qos-.*\.json$/),
      type: 'application/json', failOnCancel: false,
    }));
    expect((ReactNativeBlobUtil.fs.writeFile as jest.Mock).mock.invocationCallOrder[0])
      .toBeLessThan((Share.open as jest.Mock).mock.invocationCallOrder[0]);
  });

  it('does not write or share an empty filtered selection', async () => {
    await expect(shareMeasurements('csv', [])).rejects.toThrow('NO_MEASUREMENTS');
    expect(ReactNativeBlobUtil.fs.writeFile).not.toHaveBeenCalled();
    expect(Share.open).not.toHaveBeenCalled();
  });
});
