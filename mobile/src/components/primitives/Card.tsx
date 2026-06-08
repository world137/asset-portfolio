import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  noPad?: boolean;
}

export default function Card({ children, style, noPad }: Props) {
  const { theme } = useTheme();
  return (
    <View style={[
      {
        backgroundColor: theme.bgSurface,
        borderRadius: 14,
        padding: noPad ? 0 : 16,
        shadowColor: '#000', shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 2 }, shadowRadius: 8,
        elevation: 2,
      },
      style,
    ]}>
      {children}
    </View>
  );
}
