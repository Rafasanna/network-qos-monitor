import React, {useCallback, useEffect, useState} from 'react';
import {Alert, AppState, Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import {InfoRow} from '../../components/InfoRow';
import {getBackgroundMonitorState} from '../../storage/backgroundSettingsRepository';
import {
  disableBackgroundMonitoring,
  enableBackgroundMonitoring,
  getBackgroundRefreshAvailable,
} from './backgroundService';
import {getNotificationPermission, requestNotificationPermission, sendTestNotification} from './notifications';
import type {BackgroundMonitorState} from './types';

const STATUS_LABELS = {normal: 'Normal', degraded: 'Degradado', severe: 'Severo'} as const;

export function BackgroundSettingsCard(): React.JSX.Element {
  const [state, setState] = useState<BackgroundMonitorState | null>(null);
  const [permission, setPermission] = useState<boolean | null>(null);
  const [refreshAvailable, setRefreshAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [nextState, nextPermission, nextRefresh] = await Promise.all([
      getBackgroundMonitorState(),
      getNotificationPermission(),
      getBackgroundRefreshAvailable(),
    ]);
    setState(nextState);
    setPermission(nextPermission);
    setRefreshAvailable(nextRefresh);
  }, []);

  useEffect(() => {
    reload().catch(() => setError('No se pudo leer la configuración local.'));
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') {
        reload().catch(() => setError('No se pudo leer la configuración local.'));
      }
    });
    return () => subscription.remove();
  }, [reload]);

  const activate = useCallback(() => {
    Alert.alert(
      'Monitoreo en segundo plano',
      'Haremos chequeos ligeros de latencia TCP, sin GPS ni pruebas de descarga/subida. Si detectamos degradación severa, enviaremos una notificación local. La frecuencia real depende del sistema.',
      [
        {text: 'Cancelar', style: 'cancel'},
        {text: 'Activar', onPress: () => {
          setBusy(true);
          setError(null);
          (async () => {
            const allowed = await requestNotificationPermission();
            await enableBackgroundMonitoring();
            await reload();
            if (!allowed) {
              setError('Monitoreo activo, pero las notificaciones están denegadas.');
            }
          })().catch(() => setError('No se pudo activar el monitoreo en este dispositivo.'))
            .finally(() => setBusy(false));
        }},
      ],
    );
  }, [reload]);

  const deactivate = useCallback(() => {
    setBusy(true);
    setError(null);
    disableBackgroundMonitoring().then(reload)
      .catch(() => setError('No se pudo desactivar el monitoreo.'))
      .finally(() => setBusy(false));
  }, [reload]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Monitoreo en segundo plano</Text>
      <Text style={styles.description}>Chequeo ligero de red y tres sondas TCP por destino. No usa GPS ni throughput.</Text>
      <InfoRow label="Estado" value={state?.enabled ? 'Activo' : 'Inactivo'} />
      <InfoRow label="Última ejecución" value={state?.lastRunAt ? new Date(state.lastRunAt).toLocaleString() : 'Todavía no ejecutado'} />
      <InfoRow label="Último resultado" value={state?.lastStatus ? STATUS_LABELS[state.lastStatus] : 'No disponible'} />
      <InfoRow label="Notificaciones" value={permission === null ? 'No disponible' : permission ? 'Permitidas' : 'Denegadas'} />
      {Platform.OS === 'ios' ? (
        <InfoRow label="Background Refresh" value={refreshAvailable === null ? 'No disponible' : refreshAvailable ? 'Disponible' : 'Desactivado o restringido'} />
      ) : null}
      {permission === false ? <Text style={styles.hint}>Sin permiso, el chequeo puede ejecutarse pero no mostrará alertas.</Text> : null}
      {Platform.OS === 'ios' ? <Text style={styles.hint}>iOS decide cuándo ejecutar el chequeo y lo detiene si forzás el cierre de la app.</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" disabled={busy || !state} style={[styles.button, busy ? styles.disabled : null]} onPress={state?.enabled ? deactivate : activate}>
        <Text style={styles.buttonText}>{busy ? 'Actualizando…' : state?.enabled ? 'Desactivar' : 'Activar monitoreo periódico'}</Text>
      </Pressable>
      {__DEV__ ? <Pressable accessibilityRole="button" style={styles.testButton} onPress={() => sendTestNotification().catch(() => setError('No se pudo mostrar la notificación de prueba.'))}>
        <Text style={styles.testText}>Probar notificación</Text>
      </Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18, marginTop: 16, borderWidth: 1, borderColor: '#E5EAF1'},
  title: {color: '#101828', fontSize: 18, fontWeight: '700', marginBottom: 8},
  description: {color: '#526079', marginBottom: 12},
  hint: {color: '#526079', marginTop: 8},
  error: {color: '#B42318', marginTop: 8},
  button: {backgroundColor: '#1D4ED8', borderRadius: 10, padding: 13, alignItems: 'center', marginTop: 16},
  disabled: {opacity: 0.5},
  buttonText: {color: '#FFFFFF', fontWeight: '700'},
  testButton: {padding: 10, alignItems: 'center'},
  testText: {color: '#1D4ED8'},
});
