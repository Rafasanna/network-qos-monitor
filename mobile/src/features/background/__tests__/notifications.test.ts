import notifee from '@notifee/react-native';
import {Platform} from 'react-native';
import {notifySevereDegradation} from '../notifications';

describe('local degradation notification', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses real metrics and the Android channel', async () => {
    Object.defineProperty(Platform, 'OS', {configurable: true, value: 'android'});
    const sent = await notifySevereDegradation({
      level: 'severe', reason: 'loss', avgRttMs: 245,
      jitterMs: 10, packetLossPct: 12,
    });
    expect(sent).toBe(true);
    expect(notifee.createChannel).toHaveBeenCalledWith(expect.objectContaining({
      id: 'network-degradation', name: 'Calidad de red', vibration: false,
    }));
    expect(notifee.displayNotification).toHaveBeenCalledWith(expect.objectContaining({
      body: 'Latencia 245 ms · pérdida 12 %',
      android: expect.objectContaining({channelId: 'network-degradation', smallIcon: 'ic_stat_network'}),
    }));
  });

  it('does not display when notification permission is denied', async () => {
    (notifee.getNotificationSettings as jest.Mock).mockResolvedValueOnce({authorizationStatus: 0});
    expect(await notifySevereDegradation({
      level: 'severe', reason: 'offline', avgRttMs: null,
      jitterMs: null, packetLossPct: null,
    })).toBe(false);
    expect(notifee.displayNotification).not.toHaveBeenCalled();
  });
});
