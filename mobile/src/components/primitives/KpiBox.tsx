import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  accent?: string;
  style?: ViewStyle;
}

export default function KpiBox({ label, value, sub, subColor, accent, style }: Props) {
  const { theme } = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: theme.bgSurface, borderRadius: 12, padding: 14, elevation: 1 }, style]}>
      <Text style={[styles.label, { color: theme.fg3 }]}>{label}</Text>
      <Text style={[styles.value, { color: accent || theme.fg1 }]}>{value}</Text>
      {sub != null && <Text style={[styles.sub, { color: subColor || theme.fg3 }]}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box:   { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6 },
  label: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  value: { fontSize: 20, fontWeight: '700' },
  sub:   { fontSize: 12, marginTop: 2 },
});
