import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

type InfoRowProps = {
  label: string;
  value: string;
};

export function InfoRow({label, value}: InfoRowProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 11,
    borderBottomColor: '#E5EAF1',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    flex: 1,
    color: '#657187',
    fontSize: 15,
  },
  value: {
    flex: 1,
    color: '#172033',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
  },
});
