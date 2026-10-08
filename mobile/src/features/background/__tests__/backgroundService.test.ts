import BackgroundFetch from 'react-native-background-fetch';
import {getBackgroundMonitorState, recordBackgroundNotification, recordBackgroundRun} from '../../../storage/backgroundSettingsRepository';
import {runBackgroundMeasurement} from '../backgroundMeasurement';
import {cancelBackgroundTask, runBackgroundTask} from '../backgroundService';
import {notifySevereDegradation} from '../notifications';
import type {BackgroundMonitorState} from '../types';

jest.mock('../../../storage/backgroundSettingsRepository', () => ({
  getBackgroundMonitorState: jest.fn(),
  recordBackgroundRun: jest.fn(),
  recordBackgroundNotification: jest.fn(),
  setBackgroundMonitorEnabled: jest.fn(),
}));
jest.mock('../backgroundMeasurement', () => ({runBackgroundMeasurement: jest.fn()}));
jest.mock('../notifications', () => ({notifySevereDegradation: jest.fn()}));

const state: BackgroundMonitorState = {
  enabled: true, lastRunAt: null, lastStatus: null, lastAvgRttMs: null,
  lastPacketLossPct: null, lastNotificationAt: null,
};
const severe = {level: 'severe' as const, reason: 'offline' as const, avgRttMs: null, jitterMs: null, packetLossPct: null};

describe('background task lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getBackgroundMonitorState as jest.Mock).mockResolvedValue(state);
    (recordBackgroundRun as jest.Mock).mockResolvedValue(undefined);
    (recordBackgroundNotification as jest.Mock).mockResolvedValue(undefined);
    (notifySevereDegradation as jest.Mock).mockResolvedValue(true);
  });

  it('finishes even when a manual measurement makes the check skip', async () => {
    (runBackgroundMeasurement as jest.Mock).mockResolvedValue({kind: 'skipped'});
    await runBackgroundTask('skipped');
    expect(BackgroundFetch.finish).toHaveBeenCalledWith('skipped');
    expect(recordBackgroundRun).not.toHaveBeenCalled();
  });

  it('records real severe result, notifies and finishes once', async () => {
    (runBackgroundMeasurement as jest.Mock).mockResolvedValue({kind: 'completed', evaluation: severe});
    await runBackgroundTask('severe');
    expect(recordBackgroundRun).toHaveBeenCalledWith(severe);
    expect(notifySevereDegradation).toHaveBeenCalledWith(severe);
    expect(recordBackgroundNotification).toHaveBeenCalledTimes(1);
    expect(BackgroundFetch.finish).toHaveBeenCalledTimes(1);
    cancelBackgroundTask('severe');
    expect(BackgroundFetch.finish).toHaveBeenCalledTimes(1);
  });

  it('aborts on OS timeout and finishes without persisting a result', async () => {
    (runBackgroundMeasurement as jest.Mock).mockImplementation((_signal: AbortSignal) => new Promise(resolve => {
      _signal.addEventListener('abort', () => resolve({kind: 'cancelled'}), {once: true});
    }));
    const run = runBackgroundTask('timeout');
    await Promise.resolve();
    await Promise.resolve();
    cancelBackgroundTask('timeout');
    await run;
    expect(BackgroundFetch.finish).toHaveBeenCalledTimes(1);
    expect(recordBackgroundRun).not.toHaveBeenCalled();
  });

  it('finishes when a native dependency fails', async () => {
    (getBackgroundMonitorState as jest.Mock).mockRejectedValueOnce(new Error('database unavailable'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await runBackgroundTask('failure');
      expect(BackgroundFetch.finish).toHaveBeenCalledTimes(1);
      expect(recordBackgroundRun).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
