import notifee, {AndroidImportance, AuthorizationStatus} from '@notifee/react-native';
import {Platform} from 'react-native';
import type {DegradationEvaluation} from './types';

const CHANNEL_ID = 'network-degradation';

export async function getNotificationPermission(): Promise<boolean> {
  const settings = await notifee.getNotificationSettings();
  return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === AuthorizationStatus.PROVISIONAL;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === AuthorizationStatus.PROVISIONAL;
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Calidad de red',
      importance: AndroidImportance.DEFAULT,
      vibration: false,
    });
  }
}

function notificationBody(evaluation: DegradationEvaluation): string {
  if (evaluation.reason === 'offline') {
    return 'Sin conexión de red';
  }
  const metrics: string[] = [];
  if (evaluation.avgRttMs !== null) {
    metrics.push(`Latencia ${evaluation.avgRttMs} ms`);
  }
  if (evaluation.packetLossPct !== null) {
    metrics.push(`pérdida ${evaluation.packetLossPct} %`);
  }
  if (evaluation.jitterMs !== null && evaluation.reason === 'jitter') {
    metrics.push(`jitter ${evaluation.jitterMs} ms`);
  }
  return metrics.join(' · ') || 'Los destinos TCP no respondieron';
}

export async function notifySevereDegradation(evaluation: DegradationEvaluation): Promise<boolean> {
  if (!(await getNotificationPermission())) {
    return false;
  }
  await ensureChannel();
  await notifee.displayNotification({
    title: 'Calidad de red degradada',
    body: notificationBody(evaluation),
    android: {channelId: CHANNEL_ID, smallIcon: 'ic_stat_network'},
  });
  return true;
}

export async function sendTestNotification(): Promise<void> {
  if (!__DEV__) {
    return;
  }
  if (!(await requestNotificationPermission())) {
    return;
  }
  await ensureChannel();
  await notifee.displayNotification({
    title: 'Prueba de Network QoS Monitor',
    body: 'Las notificaciones locales están configuradas.',
    android: {channelId: CHANNEL_ID, smallIcon: 'ic_stat_network'},
  });
}
