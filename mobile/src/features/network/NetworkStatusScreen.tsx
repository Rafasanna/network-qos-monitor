import React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {InfoRow} from '../../components/InfoRow';
import {getCellularInfo} from '../../native/cellularInfo';
import {CellularInfo} from '../../native/cellularInfoTypes';
import {runLatencySession} from '../measurements/latencyEngine';
import {summarizeSession} from '../measurements/statistics';
import {runThroughputTest} from '../measurements/throughputEngine';
import type {
  LatencySessionResult,
  MeasurementSessionResult,
  MeasurementProgress,
} from '../measurements/types';
import type {ThroughputPhase} from '../measurements/throughputEngine';
import {ConnectionType} from '../../types/network';
import {refreshNetworkStatus, useNetworkStatus} from './useNetworkStatus';
import {getCurrentLocation, LocationError} from '../location/locationService';
import {saveMeasurement} from '../../storage/measurementRepository';
import {tryAcquireMeasurement} from '../measurements/measurementMutex';
import {BackgroundSettingsCard} from '../background/BackgroundSettingsCard';

export type NetworkScreenMode = 'status' | 'measure';

const typeLabels: Record<ConnectionType, string> = {
  wifi: 'WiFi',
  cellular: 'Cellular',
  ethernet: 'Ethernet',
  other: 'Otro',
};

function availableLabel(value: boolean | null): string {
  if (value === null) {
    return 'No disponible';
  }

  return value ? 'Sí' : 'No';
}

export function NetworkStatusScreen({mode = 'status'}: {mode?: NetworkScreenMode}): React.JSX.Element {
  const status = useNetworkStatus();
  const [cellularInfo, setCellularInfo] = useState<CellularInfo | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurementPhase, setMeasurementPhase] =
    useState<ThroughputPhase | 'latency' | null>(null);
  const [measurementProgress, setMeasurementProgress] =
    useState<MeasurementProgress | null>(null);
  const [sessionResult, setSessionResult] =
    useState<MeasurementSessionResult | null>(null);
  const [measurementError, setMeasurementError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const measurementController = useRef<AbortController | null>(null);
  const refreshInProgress = useRef(false);
  const connectionLabel =
    status.isConnected === null
      ? 'No disponible'
      : status.isConnected
        ? 'Conectado'
        : 'Sin conexión';

  const refresh = useCallback(async () => {
    if (refreshInProgress.current) {
      return;
    }

    refreshInProgress.current = true;
    setIsRefreshing(true);
    try {
      const [nextCellularInfo] = await Promise.all([
        getCellularInfo(),
        refreshNetworkStatus(),
      ]);
      setCellularInfo(nextCellularInfo);
    } finally {
      refreshInProgress.current = false;
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  useEffect(
    () => () => measurementController.current?.abort(),
    [],
  );

  const saveSessionWithLocation = useCallback(async (session: MeasurementSessionResult) => {
    setIsSaving(true);
    setLocationError(false);
    try {
      const location = await getCurrentLocation();
      await saveMeasurement(session, location);
      setSaveMessage('Medición guardada en el historial');
    } catch (error) {
      setLocationError(true);
      setSaveMessage(null);
      setMeasurementError(
        error instanceof LocationError && error.code === 'TIMEOUT'
          ? 'No pudimos guardar esta medición porque no obtuvimos ubicación a tiempo.'
          : 'No pudimos guardar esta medición porque falta la ubicación.',
      );
    } finally {
      setIsSaving(false);
    }
  }, []);

  const explainLocationAndSave = useCallback((session: MeasurementSessionResult) => {
    Alert.alert(
      'Guardar ubicación de la medición',
      'Usamos tu ubicación para asociar esta medición al mapa de cobertura.',
      [
        {text: 'Ahora no', style: 'cancel', onPress: () => {
          setLocationError(true);
          setMeasurementError('No pudimos guardar esta medición porque falta la ubicación.');
        }},
        {text: 'Continuar', onPress: () => { saveSessionWithLocation(session).catch(() => undefined); }},
      ],
    );
  }, [saveSessionWithLocation]);

  const startMeasurement = useCallback(async () => {
    if (measurementController.current) {
      return;
    }
    const release = tryAcquireMeasurement('manual');
    if (!release) {
      setMeasurementError('Ya hay una medición en curso. Intentá nuevamente.');
      return;
    }
    setMeasurementError(null);
    setSaveMessage(null);
    setSessionResult(null);
    setMeasurementProgress(null);
    setMeasurementPhase('latency');
    const sessionStartedAt = new Date().toISOString();
    const controller = new AbortController();
    measurementController.current = controller;
    setIsMeasuring(true);
    try {
      const refreshedNetwork = await refreshNetworkStatus();
      if (refreshedNetwork.isConnected === false) {
        setMeasurementError('Sin conexión');
        return;
      }
      const nativeCellular = await getCellularInfo();
      const result = await runLatencySession(undefined, {
        signal: controller.signal,
        networkSnapshot: {
          connectionType: refreshedNetwork.connectionType,
          cellularGeneration:
            nativeCellular.generation ?? refreshedNetwork.cellularGeneration,
          operator: nativeCellular.operator,
          signalDbm: nativeCellular.signalDbm,
        },
        onProgress: setMeasurementProgress,
      });
      if (result.cancelled) {
        setMeasurementError('Medición cancelada');
        setSessionResult({
          startedAt: sessionStartedAt,
          finishedAt: new Date().toISOString(),
          networkSnapshot: result.networkSnapshot,
          latency: result,
          throughput: null,
          cancelled: true,
        });
        return;
      }
      setMeasurementProgress(null);
      setMeasurementPhase('download');
      const throughput = await runThroughputTest({
        signal: controller.signal,
        onPhase: setMeasurementPhase,
      });
      const completedSession: MeasurementSessionResult = {
        startedAt: sessionStartedAt,
        finishedAt: new Date().toISOString(),
        networkSnapshot: result.networkSnapshot,
        latency: result,
        throughput,
        cancelled: throughput.error === 'CANCELLED',
      };
      setSessionResult(completedSession);
      if (throughput.error) {
        setMeasurementError(throughputErrorLabel(throughput.error));
      }
      if (!completedSession.cancelled) {
        explainLocationAndSave(completedSession);
      }
    } catch {
      setMeasurementError('No se pudo completar la medición');
    } finally {
      release();
      if (measurementController.current === controller) {
        measurementController.current = null;
      }
      setIsMeasuring(false);
      setMeasurementProgress(null);
      setMeasurementPhase(null);
    }
  }, [explainLocationAndSave]);

  const cancelMeasurement = useCallback(() => {
    measurementController.current?.abort();
  }, []);


  const signalLabel =
    cellularInfo?.signalDbm !== null && cellularInfo?.signalDbm !== undefined
      ? `${cellularInfo.signalDbm} dBm`
      : 'No disponible';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {mode === 'status' ? <>
      <Text style={styles.eyebrow}>Network QoS Monitor</Text>
      <Text style={styles.title}>Estado de red</Text>
      <Text style={styles.subtitle}>
        Información actualizada automáticamente por el dispositivo.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Estado actual</Text>
        <InfoRow label="Estado" value={connectionLabel} />
        <InfoRow
          label="Tipo de conexión"
          value={typeLabels[status.connectionType]}
        />
        <InfoRow
          label="Generación celular"
          value={status.cellularGeneration ?? 'No disponible'}
        />
        <InfoRow
          label="Internet disponible"
          value={availableLabel(status.isInternetReachable)}
        />
        <InfoRow
          label="Conexión costosa"
          value={availableLabel(status.isConnectionExpensive)}
        />
        <InfoRow
          label="Dirección IP local"
          value={status.ipAddress ?? 'No disponible'}
        />
      </View>

      <View style={[styles.card, styles.cellularCard]}>
        <Text style={styles.cardTitle}>Información celular</Text>
        <Text style={styles.cardDescription}>
          {status.connectionType === 'cellular'
            ? 'Red celular de la conexión activa'
            : 'Información celular del dispositivo; la conexión actual no es celular'}
        </Text>
        <InfoRow
          label="Operador"
          value={cellularInfo?.operator ?? 'No disponible'}
        />
        <InfoRow
          label="Tecnología"
          value={cellularInfo?.radioTechnology ?? 'No disponible'}
        />
        <InfoRow
          label="Generación"
          value={cellularInfo?.generation ?? 'No disponible'}
        />
        <InfoRow label="Señal" value={signalLabel} />
        <InfoRow
          label="Nivel de señal"
          value={
            cellularInfo?.signalLevel !== null &&
            cellularInfo?.signalLevel !== undefined
              ? `${cellularInfo.signalLevel} / 4`
              : 'No disponible'
          }
        />
        <InfoRow
          label="Roaming"
          value={availableLabel(cellularInfo?.isRoaming ?? null)}
        />
        {cellularInfo && !cellularInfo.available ? (
          <Text style={styles.unavailableHint}>
            El dispositivo no informa datos celulares disponibles.
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={isRefreshing}
        onPress={refresh}
        style={({pressed}) => [
          styles.refreshButton,
          pressed && !isRefreshing ? styles.refreshButtonPressed : null,
          isRefreshing ? styles.refreshButtonDisabled : null,
        ]}>
        {isRefreshing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.refreshButtonText}>Actualizar información</Text>
        )}
      </Pressable>
      <BackgroundSettingsCard />
      </> : null}

      {mode === 'measure' ? <>
      <Text style={styles.sectionTitle}>Medir calidad</Text>
      <View style={styles.card}>
        <Text style={styles.cardDescription}>
          TCP Connect RTT + HTTP Throughput · latencia y transferencia se miden por separado.
        </Text>
        {isMeasuring && measurementPhase ? (
          <View style={styles.progressBlock}>
            <Text style={styles.progressTitle}>{phaseLabel(measurementPhase)}</Text>
            {measurementPhase === 'latency' && measurementProgress ? (
              <Text style={styles.cardDescription}>
                Midiendo {measurementProgress.target.label} · sonda {measurementProgress.attempt} de {measurementProgress.probesPerTarget}
              </Text>
            ) : null}
            <Text style={styles.cardDescription}>
              Etapa {measurementPhase === 'latency' ? '1/3' : measurementPhase === 'download' ? '2/3' : '3/3'}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${measurementPhase === 'latency' && measurementProgress
                      ? Math.max(
                          4,
                          (measurementProgress.completedProbes /
                            measurementProgress.totalProbes) *
                            33,
                        )
                      : measurementPhase === 'download'
                        ? 45
                        : 75}%`,
                  },
                ]}
              />
            </View>
            {measurementPhase === 'latency' && measurementProgress ? (
              <Text style={styles.progressCaption}>
                Destino {measurementProgress.targetIndex + 1} de {measurementProgress.targetCount}
              </Text>
            ) : null}
          </View>
        ) : null}
        {measurementError ? (
          <Text style={styles.measurementError}>{measurementError}</Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={isMeasuring}
          onPress={startMeasurement}
          style={({pressed}) => [
            styles.refreshButton,
            pressed && !isMeasuring ? styles.refreshButtonPressed : null,
            isMeasuring ? styles.refreshButtonDisabled : null,
          ]}>
          <Text style={styles.refreshButtonText}>Iniciar medición</Text>
        </Pressable>
        {isMeasuring ? (
          <Pressable
            accessibilityRole="button"
            onPress={cancelMeasurement}
            style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Cancelar medición</Text>
        </Pressable>
      ) : null}
      {locationError && sessionResult && !sessionResult.cancelled ? (
        <Pressable
          accessibilityRole="button"
          disabled={isSaving}
          onPress={() => explainLocationAndSave(sessionResult)}
          style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>
            {isSaving ? 'Obteniendo ubicación…' : 'Intentar ubicación nuevamente'}
          </Text>
        </Pressable>
      ) : null}
      {isSaving ? <Text style={styles.cardDescription}>Obteniendo ubicación para guardar…</Text> : null}
      {saveMessage ? <Text style={styles.saveMessage}>{saveMessage}</Text> : null}
      </View>

      {sessionResult ? (
        <>
          <Text style={styles.sectionTitle}>Resultados TCP</Text>
          {sessionResult.latency.targets.map(measurement => (
            <View key={measurement.target.id} style={[styles.card, styles.resultCard]}>
              <Text style={styles.cardTitle}>{measurement.target.label}</Text>
              {measurement.received === 0 ? (
                <Text style={styles.measurementError}>
                  Sin respuesta · {targetFailureLabel(measurement.probes)}
                </Text>
              ) : null}
              <InfoRow label="Mínimo" value={formatMs(measurement.minRttMs)} />
              <InfoRow label="Promedio" value={formatMs(measurement.avgRttMs)} />
              <InfoRow label="Máximo" value={formatMs(measurement.maxRttMs)} />
              <InfoRow label="Jitter" value={formatMs(measurement.jitterMs)} />
              <InfoRow label="Pérdida" value={`${measurement.packetLossPct} %`} />
              <Text style={styles.cardDescription}>
                {measurement.received}/{measurement.sent} sondas recibidas
              </Text>
            </View>
          ))}
          <View style={[styles.card, styles.summaryCard]}>
            <Text style={styles.cardTitle}>Resumen de sesión</Text>
            <InfoRow
              label="Latencia promedio global"
              value={formatMs(summarizeSession(sessionResult.latency.targets).avgRttMs)}
            />
            <InfoRow
              label="Jitter promedio"
              value={formatMs(summarizeSession(sessionResult.latency.targets).jitterMs)}
            />
            <InfoRow
              label="Pérdida total"
              value={`${summarizeSession(sessionResult.latency.targets).packetLossPct} %`}
            />
            <Text style={styles.cardDescription}>
              Red durante la sesión: {sessionResult.networkSnapshot.connectionType}
              {sessionResult.networkSnapshot.cellularGeneration
                ? ` · ${sessionResult.networkSnapshot.cellularGeneration}`
                : ''}
              {sessionResult.networkSnapshot.operator
                ? ` · ${sessionResult.networkSnapshot.operator}`
                : ''}
              {sessionResult.networkSnapshot.signalDbm !== null
                ? ` · ${sessionResult.networkSnapshot.signalDbm} dBm`
                : ''}
            </Text>
          </View>
          <View style={[styles.card, styles.summaryCard]}>
            <Text style={styles.cardTitle}>Throughput HTTP</Text>
            <InfoRow
              label="Descarga"
              value={formatMbps(sessionResult.throughput?.download?.mbps ?? null)}
            />
            <InfoRow
              label="Subida"
              value={formatMbps(sessionResult.throughput?.upload?.mbps ?? null)}
            />
            <Text style={styles.cardDescription}>
              Bytes: {sessionResult.throughput?.download?.bytes ?? 'No disponible'} descargados · {sessionResult.throughput?.upload?.bytes ?? 'No disponible'} subidos
            </Text>
          </View>
        </>
      ) : null}
      </> : null}
    </ScrollView>
  );
}

function formatMs(value: number | null): string {
  return value === null ? 'No disponible' : `${value} ms`;
}

function formatMbps(value: number | null): string {
  return value === null ? 'No disponible' : `${value.toFixed(1)} Mbps`;
}

function phaseLabel(phase: ThroughputPhase | 'latency'): string {
  if (phase === 'latency') {
    return 'Midiendo latencia TCP';
  }
  return phase === 'download'
    ? 'Verificando servidor / descargando'
    : 'Midiendo subida';
}

function throughputErrorLabel(error: string): string {
  switch (error) {
    case 'SERVER_UNAVAILABLE':
      return 'Servidor de medición no disponible';
    case 'CANCELLED':
      return 'Medición cancelada';
    case 'DOWNLOAD_SIZE_MISMATCH':
      return 'La descarga recibida no coincide con el tamaño esperado';
    case 'UPLOAD_SIZE_MISMATCH':
      return 'El servidor confirmó una cantidad de bytes distinta';
    default:
      return 'No se pudo completar la prueba de throughput';
  }
}

function targetFailureLabel(
  probes: LatencySessionResult['targets'][number]['probes'],
): string {
  if (probes.some(probe => probe.errorCode === 'TIMEOUT')) {
    return 'Tiempo de espera agotado';
  }
  if (
    probes.some(
      probe => probe.errorCode === 'ENETUNREACH' || probe.errorCode === 'ENETDOWN',
    )
  ) {
    return 'Sin conexión';
  }
  return 'Host no disponible';
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  eyebrow: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  title: {
    color: '#101828',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: '#657187',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5EAF1',
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  cardTitle: {
    color: '#101828',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDescription: {
    color: '#657187',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 2,
  },
  cellularCard: {
    marginTop: 16,
  },
  unavailableHint: {
    color: '#8A94A6',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 50,
    paddingHorizontal: 18,
  },
  refreshButtonPressed: {
    backgroundColor: '#1D4ED8',
  },
  refreshButtonDisabled: {
    opacity: 0.75,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#101828',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 28,
  },
  progressBlock: {
    marginTop: 18,
  },
  progressTitle: {
    color: '#101828',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 5,
  },
  progressTrack: {
    backgroundColor: '#E8EDF5',
    borderRadius: 8,
    height: 10,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    height: '100%',
  },
  progressCaption: {
    color: '#657187',
    fontSize: 12,
    marginTop: 6,
  },
  measurementError: {
    color: '#B42318',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  saveMessage: {
    color: '#027A48',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: '#D0D5DD',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 46,
  },
  cancelButtonText: {
    color: '#344054',
    fontSize: 15,
    fontWeight: '700',
  },
  resultCard: {
    marginTop: 10,
  },
  summaryCard: {
    marginTop: 12,
  },
});
