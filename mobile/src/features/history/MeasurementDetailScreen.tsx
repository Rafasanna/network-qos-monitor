import React, {useEffect, useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {InfoRow} from '../../components/InfoRow';
import {deleteMeasurement, getMeasurementById} from '../../storage/measurementRepository';
import type {StoredMeasurement} from '../../storage/measurementRepository';

type Props = {id: string; onBack: () => void};

export function MeasurementDetailScreen({id, onBack}: Props): React.JSX.Element {
  const [item, setItem] = useState<StoredMeasurement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    getMeasurementById(id).then(result => {
      if (active) {
        setItem(result);
        setLoading(false);
      }
    }).catch(() => {
      if (active) {
        setError(true);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [id]);

  const confirmDelete = () => {
    if (!item) return;
    Alert.alert('Eliminar medición', 'Esta acción borrará la sesión y sus resultados por destino.', [
      {text: 'Cancelar', style: 'cancel'},
      {text: 'Eliminar', style: 'destructive', onPress: () => {
        deleteMeasurement(item.id).then(onBack)
          .catch(() => Alert.alert('Error', 'No se pudo eliminar la medición.'));
      }},
    ]);
  };

  return <ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={onBack}><Text style={styles.back}>‹ Volver</Text></Pressable>
    <Text style={styles.title}>Detalle de medición</Text>
    {loading ? <Text style={styles.caption}>Cargando detalle…</Text> : null}
    {error || (!loading && !item) ? <Text style={styles.caption}>No se pudo abrir esta medición.</Text> : null}
    {item ? <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sesión</Text>
        <InfoRow label="Fecha" value={new Date(item.startedAt).toLocaleString()} />
        <InfoRow label="Ubicación" value={`${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}`} />
        <InfoRow label="Precisión GPS" value={`${Math.round(item.locationAccuracyM)} m`} />
        <InfoRow label="Tipo de conexión" value={item.connectionType} />
        <InfoRow label="Generación" value={item.cellularGeneration ?? 'No disponible'} />
        <InfoRow label="Operador" value={item.operator ?? 'No disponible'} />
        <InfoRow label="Señal" value={item.signalDbm === null ? 'No disponible' : `${item.signalDbm} dBm`} />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Calidad</Text>
        <InfoRow label="RTT promedio" value={formatMs(item.globalAvgRttMs)} />
        <InfoRow label="Jitter" value={formatMs(item.globalJitterMs)} />
        <InfoRow label="Pérdida" value={`${item.globalPacketLossPct} %`} />
        <InfoRow label="Descarga" value={formatMbps(item.downloadMbps)} />
        <InfoRow label="Subida" value={formatMbps(item.uploadMbps)} />
      </View>
      <Text style={styles.sectionTitle}>Destinos</Text>
      {item.targets.map(target => <View key={target.targetId} style={styles.card}>
        <Text style={styles.cardTitle}>{target.label}</Text>
        <Text style={styles.caption}>{target.host}:{target.port} · {target.received}/{target.sent} sondas</Text>
        <InfoRow label="Mínimo" value={formatMs(target.minRttMs)} />
        <InfoRow label="Promedio" value={formatMs(target.avgRttMs)} />
        <InfoRow label="Máximo" value={formatMs(target.maxRttMs)} />
        <InfoRow label="Jitter" value={formatMs(target.jitterMs)} />
        <InfoRow label="Pérdida" value={`${target.packetLossPct} %`} />
      </View>)}
      <Pressable accessibilityRole="button" style={styles.deleteButton} onPress={confirmDelete}>
        <Text style={styles.deleteText}>Eliminar medición</Text>
      </Pressable>
    </> : null}
  </ScrollView>;
}

function formatMs(value: number | null): string {
  return value === null ? 'No disponible' : `${value} ms`;
}
function formatMbps(value: number | null): string {
  return value === null ? 'No disponible' : `${value.toFixed(1)} Mbps`;
}

const styles = StyleSheet.create({
  content: {padding: 20, paddingBottom: 36, gap: 12},
  back: {color: '#2563EB', fontSize: 16, fontWeight: '700'},
  title: {color: '#101828', fontSize: 28, fontWeight: '800'},
  sectionTitle: {color: '#101828', fontSize: 20, fontWeight: '700', marginTop: 12},
  card: {backgroundColor: '#FFF', borderColor: '#E5EAF1', borderRadius: 16, borderWidth: 1, padding: 16},
  cardTitle: {color: '#101828', fontSize: 17, fontWeight: '700'},
  caption: {color: '#657187', fontSize: 13, marginTop: 5},
  deleteButton: {alignItems: 'center', borderColor: '#D92D20', borderRadius: 12, borderWidth: 1, padding: 15},
  deleteText: {color: '#B42318', fontWeight: '700'},
});
