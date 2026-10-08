import React, {useEffect, useState} from 'react';
import {Pressable, StatusBar, StyleSheet, Text, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';

import {NetworkStatusScreen} from '../features/network/NetworkStatusScreen';
import {HistoryScreen} from '../features/history/HistoryScreen';
import {MeasurementDetailScreen} from '../features/history/MeasurementDetailScreen';
import {TrendsScreen} from '../features/history/TrendsScreen';
import {MapScreen} from '../features/map/MapScreen';
import {registerBackgroundTasks} from '../features/background/backgroundService';

type Tab = 'status' | 'measure' | 'history' | 'map' | 'trends';

function AppContent(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('status');
  const [detailId, setDetailId] = useState<string | null>(null);
  const goToTab = (next: Tab) => {
    setDetailId(null);
    setTab(next);
  };
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.tabs}>
        {(['status', 'measure', 'history', 'map'] as const).map(item => (
          <Pressable key={item} accessibilityRole="button" onPress={() => goToTab(item)} style={[styles.tab, tab === item || (tab === 'trends' && item === 'history') ? styles.activeTab : null]}>
            <Text style={[styles.tabText, tab === item || (tab === 'trends' && item === 'history') ? styles.activeTabText : null]}>
              {item === 'status' ? 'Estado' : item === 'measure' ? 'Medir' : item === 'history' ? 'Historial' : 'Mapa'}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.screen, tab === 'status' || tab === 'measure' ? null : styles.hidden]}>
        <NetworkStatusScreen mode={tab === 'measure' ? 'measure' : 'status'} />
      </View>
      {detailId ? <View style={styles.screen}>
        <MeasurementDetailScreen id={detailId} onBack={() => setDetailId(null)} />
      </View> : null}
      {!detailId && tab === 'history' ? <View style={styles.screen}>
        <HistoryScreen onMeasure={() => goToTab('measure')} onTrends={() => goToTab('trends')}
          onOpenDetail={setDetailId} />
      </View> : null}
      {!detailId && tab === 'map' ? <View style={styles.screen}>
        <MapScreen onMeasure={() => goToTab('measure')} onOpenDetail={setDetailId} />
      </View> : null}
      {!detailId && tab === 'trends' ? <View style={styles.screen}>
        <TrendsScreen onBack={() => goToTab('history')} onMeasure={() => goToTab('measure')} />
      </View> : null}
    </SafeAreaView>
  );
}

export default function App(): React.JSX.Element {
  useEffect(() => {
    registerBackgroundTasks().catch(() => undefined);
  }, []);
  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <AppContent />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  tabs: {flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF', borderBottomColor: '#E5EAF1', borderBottomWidth: 1},
  tab: {alignItems: 'center', borderRadius: 10, flex: 1, paddingVertical: 10},
  activeTab: {backgroundColor: '#EAF1FF'},
  tabText: {color: '#657187', fontSize: 14, fontWeight: '600'},
  activeTabText: {color: '#1D4ED8'},
  screen: {flex: 1},
  hidden: {display: 'none'},
});
