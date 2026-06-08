import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export default function Separator({ mx = 0 }: { mx?: number }) {
  const { theme } = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.border1, marginHorizontal: mx }} />;
}
