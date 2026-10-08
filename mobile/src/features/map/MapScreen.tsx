import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import WebView from 'react-native-webview';

import {getMeasurementById, getMeasurementsForMap} from '../../storage/measurementRepository';
import type {MapMeasurement} from '../../storage/measurementRepository';
import {LEAFLET_SOURCE} from './leafletHtml';
import {parseWebMapMessage, serializeWebMapPoints, toWebMapPoints} from './webMapData';

type Props = {onMeasure: () => void; onOpenDetail: (id: string) => void};
type Layer = 'heatmap' | 'points';

export function MapScreen({onMeasure, onOpenDetail}: Props): React.JSX.Element {
  const [items, setItems] = useState<MapMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);
  const [webReady, setWebReady] = useState(false);
  const [layer, setLayer] = useState<Layer>('heatmap');
  const webRef = useRef<WebView>(null);
  const points = useMemo(() => toWebMapPoints(items), [items]);
  const serializedPoints = useMemo(() => serializeWebMapPoints(points), [points]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setItems(await getMeasurementsForMap());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load().catch(() => undefined); }, [load]);

  useEffect(() => {
    if (webReady) {
      webRef.current?.injectJavaScript(`window.setMapData(${serializedPoints}); true;`);
    }
  }, [serializedPoints, webReady]);
  useEffect(() => {
    if (webReady) {
      webRef.current?.injectJavaScript(`window.setMapMode(${JSON.stringify(layer)}); true;`);
    }
  }, [layer, webReady]);

  const handleMessage = useCallback((raw: string) => {
    const message = parseWebMapMessage(raw);
    if (message?.type === 'ready') {
      setWebReady(true);
    } else if (message?.type === 'tilesLoaded') {
      console.info('OpenStreetMap base tiles loaded');
    } else if (message?.type === 'error') {
      setWebError(message.message);
    } else if (message?.type === 'openDetail' && points.some(point => point.id === message.id)) {
      getMeasurementById(message.id).then(item => {
        if (item) onOpenDetail(item.id);
      }).catch(() => setError(true));
    }
  }, [onOpenDetail, points]);

  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.title}>Mapa de cobertura</Text>
    <Text style={styles.caption}>Mediciones georreferenciadas guardadas en SQLite local.</Text>
    {loading ? <Text style={styles.caption}>Cargando mapa…</Text> : null}
    {error ? <>
      <Text style={styles.caption}>No se pudieron cargar las mediciones del mapa.</Text>
      <Action label="Reintentar" onPress={() => { load().catch(() => undefined); }} />
    </> : null}
    {!loading && !error ? <>
      {points.length === 0 ? <>
        <Text style={styles.caption}>Todavía no hay mediciones para mostrar.</Text>
        <Action label="Realizar medición" onPress={onMeasure} />
      </> : null}
      <View style={styles.controlRow}>
        <Choice label="Puntos" selected={layer === 'points'} onPress={() => setLayer('points')} />
        <Choice label="Heatmap" selected={layer === 'heatmap'} onPress={() => setLayer('heatmap')} />
      </View>
      <WebView
        ref={webRef}
        style={styles.map}
        source={LEAFLET_SOURCE}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        applicationNameForUserAgent="NetworkQosMonitor/1.0 (com.networkqosmonitor)"
        onLoadStart={() => { setWebReady(false); setWebError(null); }}
        onError={() => setWebError('No se pudo abrir el mapa. Comprobá la conexión a Internet.')}
        onMessage={event => handleMessage(event.nativeEvent.data)}
      />
      {webError ? <Text style={styles.error}>{webError}</Text> : null}
      {layer === 'heatmap' && points.length > 0 &&
        points.every(point => point.heatWeight === null) ?
        <Text style={styles.caption}>No hay métricas suficientes para calcular el calor.</Text> : null}
      <Text style={styles.caption}>
        {layer === 'heatmap'
          ? 'Intensidad relativa de zonas con peor calidad; puntos próximos se combinan.'
          : 'Tocá un punto para ver la medición y abrir su detalle.'}
      </Text>
    </> : null}
  </ScrollView>;
}

function Choice({label, selected, onPress}: {label: string; selected: boolean; onPress: () => void}) {
  return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress}
    style={[styles.choice, selected ? styles.choiceSelected : null]}>
    <Text style={[styles.choiceText, selected ? styles.choiceTextSelected : null]}>{label}</Text>
  </Pressable>;
}

function Action({label, onPress}: {label: string; onPress: () => void}) {
  return <Pressable accessibilityRole="button" style={styles.action} onPress={onPress}>
    <Text style={styles.actionText}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  content: {padding: 16, paddingBottom: 32, gap: 10},
  title: {color: '#101828', fontSize: 28, fontWeight: '800'},
  caption: {color: '#657187', fontSize: 13, lineHeight: 19},
  error: {color: '#B42318', fontSize: 13, lineHeight: 19},
  controlRow: {flexDirection: 'row', gap: 6},
  choice: {borderColor: '#CBD5E1', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8},
  choiceSelected: {borderColor: '#2563EB', backgroundColor: '#EAF1FF'},
  choiceText: {color: '#475467', fontSize: 12, fontWeight: '600'},
  choiceTextSelected: {color: '#1D4ED8'},
  map: {height: 420, borderRadius: 14, backgroundColor: '#EEF3F6'},
  action: {alignItems: 'center', backgroundColor: '#2563EB', borderRadius: 12, padding: 14},
  actionText: {color: '#FFF', fontWeight: '700'},
});
