import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props { label: string; color?: string; bg?: string; }

export default function Pill({ label, color = '#fff', bg = '#9a6b1f' }: Props) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  text: { fontSize: 11, fontWeight: '600' },
});
