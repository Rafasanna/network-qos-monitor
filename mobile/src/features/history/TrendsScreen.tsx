import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Line, Polyline} from 'react-native-svg';

import {getMeasurementsForCharts} from '../../storage/measurementRepository';
import type {ChartMeasurement} from '../../storage/measurementRepository';
import {buildChartSeries} from './chartData';
import type {ChartMetric, ChartPoint} from './chartData';

type Props = {onBack: () => void; onMeasure: () => void};

const CHARTS: {metric: ChartMetric; title: string; unit: string; color: string}[] = [
  {metric: 'globalAvgRttMs', title: 'Latencia promedio', unit: 'ms', color: '#2563EB'},
  {metric: 'downloadMbps', title: 'Download', unit: 'Mbps', color: '#16A34A'},
  {metric: 'uploadMbps', title: 'Upload', unit: 'Mbps', color: '#EA580C'},
];

export function TrendsScreen({onBack, onMeasure}: Props): React.JSX.Element {
  const [items, setItems] = useState<ChartMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setItems(await getMeasurementsForCharts());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load().catch(() => undefined); }, [load]);

  return <ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={onBack}><Text style={styles.back}>‹ Historial</Text></Pressable>
    <Text style={styles.title}>Tendencias de red</Text>
    <Text style={styles.caption}>Datos medidos y guardados en este dispositivo.</Text>
    {loading ? <Text style={styles.caption}>Cargando tendencias…</Text> : null}
    {error ? <>
      <Text style={styles.caption}>No se pudieron cargar las tendencias.</Text>
      <Action label="Reintentar" onPress={() => { load().catch(() => undefined); }} />
    </> : null}
    {!loading && !error && items.length === 0 ? <>
      <Text style={styles.caption}>No hay datos suficientes.</Text>
      <Action label="Realizar medición" onPress={onMeasure} />
    </> : null}
    {!loading && !error && items.length > 0 ? <>
      {items.length === 1 ? <Text style={styles.caption}>
        Hay una medición; todavía no existe tendencia temporal.
      </Text> : null}
      {CHARTS.map(chart => <TrendChart key={chart.metric} measurements={items} {...chart} />)}
    </> : null}
  </ScrollView>;
}

function TrendChart({measurements, metric, title, unit, color}: {
  measurements: readonly ChartMeasurement[];
  metric: ChartMetric;
  title: string;
  unit: string;
  color: string;
}): React.JSX.Element {
  const [width, setWidth] = useState(300);
  const points = useMemo(() => buildChartSeries(measurements, metric), [measurements, metric]);
  const chart = useMemo(() => layoutPoints(points, width), [points, width]);

  return <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text>
    {points.length === 0 ? <Text style={styles.caption}>No disponible</Text> : <>
      <Text style={styles.caption}>Máximo observado: {chart.maximum.toFixed(1)} {unit}</Text>
      <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        <Svg width={width} height={160} accessibilityLabel={`Gráfico de ${title}`}>
          {[40, 85, 130].map(y => <Line key={y} x1={28} y1={y} x2={width - 10} y2={y} stroke="#E5EAF1" strokeWidth={1} />)}
          {chart.coordinates.length >= 2 ? <Polyline
            points={chart.coordinates.map(point => `${point.x},${point.y}`).join(' ')}
            fill="none" stroke={color} strokeWidth={2} /> : null}
          {chart.coordinates.map((point, index) => <Circle key={`${point.timestampMs}-${index}`}
            cx={point.x} cy={point.y} r={4} fill={color} />)}
        </Svg>
      </View>
      <View style={styles.axisLabels}>
        <Text style={styles.axisLabel}>{formatDate(points[0].startedAt)}</Text>
        {points.length > 1 ? <Text style={styles.axisLabel}>{formatDate(points[points.length - 1].startedAt)}</Text> : null}
      </View>
      {points.length === 1 ? <Text style={styles.caption}>Un punto disponible; aún no hay tendencia.</Text> : null}
    </>}
  </View>;
}

function layoutPoints(points: readonly ChartPoint[], width: number) {
  const maximum = points.reduce((max, point) => Math.max(max, point.value), 0);
  const scaleMaximum = Math.max(1, maximum);
  const first = points[0]?.timestampMs ?? 0;
  const last = points[points.length - 1]?.timestampMs ?? first;
  const plotWidth = Math.max(1, width - 42);
  return {
    maximum,
    coordinates: points.map(point => ({
      timestampMs: point.timestampMs,
      x: last === first ? 28 + plotWidth / 2 : 28 + ((point.timestampMs - first) / (last - first)) * plotWidth,
      y: 130 - (point.value / scaleMaximum) * 90,
    })),
  };
}

function Action({label, onPress}: {label: string; onPress: () => void}) {
  return <Pressable style={styles.action} onPress={onPress}><Text style={styles.actionText}>{label}</Text></Pressable>;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

const styles = StyleSheet.create({
  content: {padding: 20, paddingBottom: 36, gap: 12},
  back: {color: '#2563EB', fontSize: 16, fontWeight: '700'},
  title: {color: '#101828', fontSize: 28, fontWeight: '800'},
  caption: {color: '#657187', fontSize: 13, marginTop: 5},
  card: {backgroundColor: '#FFF', borderColor: '#E5EAF1', borderRadius: 16, borderWidth: 1, padding: 16},
  cardTitle: {color: '#101828', fontSize: 17, fontWeight: '700'},
  axisLabels: {flexDirection: 'row', justifyContent: 'space-between'},
  axisLabel: {color: '#657187', fontSize: 11, maxWidth: '49%'},
  action: {alignItems: 'center', backgroundColor: '#2563EB', borderRadius: 12, padding: 15},
  actionText: {color: '#FFF', fontWeight: '700'},
});
