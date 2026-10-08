import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';

import {
  getHistoryFilterOptions, getMeasurementCount, getMeasurementsByFilters,
} from '../../storage/measurementRepository';
import type {HistoryFilterOptions, StoredMeasurement} from '../../storage/measurementRepository';
import type {CellularGeneration, ConnectionType} from '../../types/network';
import {shareMeasurements} from '../export/exportService';
import type {ExportFormat} from '../export/serialization';
import {
  EMPTY_HISTORY_FILTERS, filterByGeographicRadius, GEO_RADII_METERS,
  hasActiveFilters, isValidDateInput, utcDateBounds,
} from './historyFilters';
import type {HistoryFilters} from './historyFilters';

type Props = {onMeasure: () => void; onOpenDetail: (id: string) => void; onTrends: () => void};
const NETWORK_LABELS: Record<ConnectionType, string> = {
  wifi: 'WiFi', cellular: 'Cellular', ethernet: 'Ethernet', other: 'Otro',
};
const NETWORK_ORDER: ConnectionType[] = ['wifi', 'cellular', 'ethernet', 'other'];
const GENERATION_ORDER: CellularGeneration[] = ['2G', '3G', '4G', '5G'];

export function HistoryScreen({onMeasure, onOpenDetail, onTrends}: Props): React.JSX.Element {
  const [sqlItems, setSqlItems] = useState<StoredMeasurement[]>([]);
  const [options, setOptions] = useState<HistoryFilterOptions>({connectionTypes: [], cellularGenerations: []});
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<HistoryFilters>(EMPTY_HISTORY_FILTERS);
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [nextItems, nextOptions, nextCount] = await Promise.all([
        getMeasurementsByFilters({
          connectionType: filters.connectionType,
          cellularGeneration: filters.cellularGeneration,
          ...utcDateBounds(filters.fromDate, filters.toDate),
        }),
        getHistoryFilterOptions(), getMeasurementCount(),
      ]);
      setSqlItems(nextItems);
      setOptions(nextOptions);
      setTotalCount(nextCount);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filters.connectionType, filters.cellularGeneration, filters.fromDate, filters.toDate]);

  useEffect(() => {load().catch(() => undefined);}, [load]);
  const items = useMemo(
    () => filterByGeographicRadius(sqlItems, filters.geoCenter, filters.radiusMeters),
    [sqlItems, filters.geoCenter, filters.radiusMeters],
  );
  const filtered = hasActiveFilters(filters);

  const applyDates = () => {
    const from = draftFrom.trim();
    const to = draftTo.trim();
    if ((from && !isValidDateInput(from)) || (to && !isValidDateInput(to))) {
      setInputError('Usá fechas válidas con formato AAAA-MM-DD.');
      return;
    }
    if (from && to && from > to) {
      setInputError('La fecha Desde no puede ser posterior a Hasta.');
      return;
    }
    setInputError(null);
    setFilters(current => ({...current, fromDate: from || null, toDate: to || null}));
  };

  const exportVisible = (format: ExportFormat) => {
    setExporting(true);
    setExportError(null);
    shareMeasurements(format, items.map(item => item.id))
      .catch(() => setExportError('No se pudo generar o compartir el archivo.'))
      .finally(() => setExporting(false));
  };

  const confirmExport = () => Alert.alert(
    filtered ? 'Exportar resultados filtrados' : 'Exportar historial',
    `Se exportarán ${items.length} mediciones visibles. El archivo incluye coordenadas de las mediciones. Elegí un formato para abrir la hoja de compartir.`,
    [
      {text: 'Cancelar', style: 'cancel'},
      {text: 'CSV', onPress: () => exportVisible('csv')},
      {text: 'JSON', onPress: () => exportVisible('json')},
    ],
  );

  const clearFilters = () => {
    setFilters(EMPTY_HISTORY_FILTERS);
    setDraftFrom(''); setDraftTo(''); setInputError(null);
  };

  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>Historial</Text>
    <Action label="Ver tendencias" onPress={onTrends} />
    <View style={styles.filterCard}>
      <Text style={styles.sectionTitle}>Filtros</Text>
      <Text style={styles.caption}>Tipo de red</Text>
      <View style={styles.row}>
        <Choice label="Todos" selected={!filters.connectionType} onPress={() => setFilters(current => ({...current, connectionType: null, cellularGeneration: null}))} />
        {NETWORK_ORDER.filter(type => options.connectionTypes.includes(type)).map(type =>
          <Choice key={type} label={NETWORK_LABELS[type]} selected={filters.connectionType === type}
            onPress={() => setFilters(current => ({...current, connectionType: type, cellularGeneration: null}))} />)}
      </View>
      {filters.connectionType === 'cellular' && options.cellularGenerations.length > 0 ? <>
        <Text style={styles.caption}>Generación celular</Text>
        <View style={styles.row}>
          <Choice label="Todas" selected={!filters.cellularGeneration} onPress={() => setFilters(current => ({...current, cellularGeneration: null}))} />
          {GENERATION_ORDER.filter(generation => options.cellularGenerations.includes(generation)).map(generation =>
            <Choice key={generation} label={generation} selected={filters.cellularGeneration === generation}
              onPress={() => setFilters(current => ({...current, cellularGeneration: generation}))} />)}
        </View>
      </> : null}
      <Text style={styles.caption}>Fechas UTC · AAAA-MM-DD</Text>
      <View style={styles.dateRow}>
        <TextInput accessibilityLabel="Desde" placeholder="Desde" value={draftFrom} onChangeText={setDraftFrom}
          autoCapitalize="none" keyboardType="numbers-and-punctuation" style={styles.dateInput} />
        <TextInput accessibilityLabel="Hasta" placeholder="Hasta" value={draftTo} onChangeText={setDraftTo}
          autoCapitalize="none" keyboardType="numbers-and-punctuation" style={styles.dateInput} />
      </View>
      <Action label="Aplicar fechas" onPress={applyDates} />
      {inputError ? <Text style={styles.error}>{inputError}</Text> : null}
      <Text style={styles.caption}>Zona: elegí una medición como centro con «Usar como centro».</Text>
      {filters.geoCenter ? <>
        <Text style={styles.caption}>Radio desde la medición elegida</Text>
        <View style={styles.row}>
          {GEO_RADII_METERS.map(radius => <Choice key={radius} label={radius < 1000 ? `${radius} m` : `${radius / 1000} km`}
            selected={filters.radiusMeters === radius} onPress={() => setFilters(current => ({...current, radiusMeters: radius}))} />)}
        </View>
      </> : null}
      {filtered ? <>
        <Text style={styles.caption}>Filtros activos</Text>
        <View style={styles.row}>
          {filters.connectionType ? <Choice label={`${NETWORK_LABELS[filters.connectionType]} ×`} selected onPress={() => setFilters(current => ({...current, connectionType: null, cellularGeneration: null}))} /> : null}
          {filters.cellularGeneration ? <Choice label={`${filters.cellularGeneration} ×`} selected onPress={() => setFilters(current => ({...current, cellularGeneration: null}))} /> : null}
          {filters.fromDate || filters.toDate ? <Choice label={`${filters.fromDate ?? '…'} → ${filters.toDate ?? '…'} ×`} selected onPress={() => {setDraftFrom(''); setDraftTo(''); setFilters(current => ({...current, fromDate: null, toDate: null}));}} /> : null}
          {filters.geoCenter ? <Choice label={`Radio ${filters.radiusMeters < 1000 ? `${filters.radiusMeters} m` : `${filters.radiusMeters / 1000} km`} ×`} selected onPress={() => setFilters(current => ({...current, geoCenter: null}))} /> : null}
        </View>
        <Action label="Limpiar filtros" onPress={clearFilters} />
      </> : null}
    </View>
    {!loading && !error && items.length > 0 ? <Action label={exporting ? 'Preparando exportación…' : filtered ? `Exportar resultados filtrados (${items.length})` : `Exportar (${items.length})`}
      disabled={exporting} onPress={confirmExport} /> : null}
    {exportError ? <Text style={styles.error}>{exportError}</Text> : null}
    {loading ? <Text style={styles.caption}>Cargando mediciones…</Text> : null}
    {error ? <>
      <Text style={styles.caption}>No se pudo cargar el historial.</Text>
      <Action label="Reintentar" onPress={() => {load().catch(() => undefined);}} />
    </> : null}
    {!loading && !error && totalCount === 0 ? <>
      <Text style={styles.caption}>Todavía no hay mediciones guardadas.</Text>
      <Action label="Realizar una medición" onPress={onMeasure} />
    </> : null}
    {!loading && !error && totalCount > 0 && items.length === 0 ? <Text style={styles.caption}>No hay mediciones que coincidan con estos filtros.</Text> : null}
    {!loading && !error ? items.map(item => <View key={item.id} style={styles.card}>
      <Pressable accessibilityRole="button" onPress={() => onOpenDetail(item.id)}>
        <Text style={styles.cardTitle}>{new Date(item.startedAt).toLocaleString()}</Text>
        <Text style={styles.caption}>{item.cellularGeneration ?? NETWORK_LABELS[item.connectionType]}</Text>
        <Text style={styles.metrics}>Latencia {formatMs(item.globalAvgRttMs)}   ↓ {formatMbps(item.downloadMbps)}   ↑ {formatMbps(item.uploadMbps)}</Text>
        <Text style={styles.caption}>Ubicación registrada · Ver detalle ›</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => setFilters(current => ({...current, geoCenter: {id: item.id, latitude: item.latitude, longitude: item.longitude}}))}
        style={styles.centerAction}><Text style={styles.centerActionText}>Usar como centro del filtro geográfico</Text></Pressable>
    </View>) : null}
  </ScrollView>;
}

function Action({label, onPress, disabled = false}: {label: string; onPress: () => void; disabled?: boolean}) {
  return <Pressable accessibilityRole="button" disabled={disabled} style={[styles.action, disabled ? styles.disabled : null]} onPress={onPress}>
    <Text style={styles.actionText}>{label}</Text>
  </Pressable>;
}
function Choice({label, selected, onPress}: {label: string; selected: boolean; onPress: () => void}) {
  return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress}
    style={[styles.choice, selected ? styles.choiceSelected : null]}>
    <Text style={[styles.choiceText, selected ? styles.choiceTextSelected : null]}>{label}</Text>
  </Pressable>;
}
function formatMs(value: number | null): string {
  return value === null ? 'No disponible' : `${value} ms`;
}
function formatMbps(value: number | null): string {
  return value === null ? 'No disponible' : `${value.toFixed(1)} Mbps`;
}

const styles = StyleSheet.create({
  content: {padding: 20, paddingBottom: 36, gap: 12},
  title: {color: '#101828', fontSize: 28, fontWeight: '800', marginBottom: 8},
  sectionTitle: {color: '#101828', fontSize: 18, fontWeight: '700'},
  filterCard: {backgroundColor: '#FFF', borderColor: '#E5EAF1', borderRadius: 16, borderWidth: 1, padding: 16, gap: 10},
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  choice: {borderWidth: 1, borderColor: '#C7D2E4', borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7},
  choiceSelected: {backgroundColor: '#DBEAFE', borderColor: '#2563EB'},
  choiceText: {color: '#344054', fontSize: 13},
  choiceTextSelected: {color: '#1D4ED8', fontWeight: '700'},
  dateRow: {flexDirection: 'row', gap: 8},
  dateInput: {flex: 1, borderWidth: 1, borderColor: '#C7D2E4', borderRadius: 8, padding: 10, color: '#101828'},
  card: {backgroundColor: '#FFF', borderColor: '#E5EAF1', borderRadius: 16, borderWidth: 1, padding: 16},
  cardTitle: {color: '#101828', fontSize: 17, fontWeight: '700'},
  caption: {color: '#657187', fontSize: 13, marginTop: 5},
  metrics: {color: '#344054', fontSize: 14, marginTop: 12},
  action: {alignItems: 'center', backgroundColor: '#2563EB', borderRadius: 12, padding: 13},
  actionText: {color: '#FFF', fontWeight: '700'},
  disabled: {opacity: 0.5},
  centerAction: {marginTop: 12, paddingVertical: 8},
  centerActionText: {color: '#1D4ED8', fontWeight: '600'},
  error: {color: '#B42318', fontSize: 13},
});
