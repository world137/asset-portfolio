import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '../../hooks/useTheme';
import MoreScreen from '../../screens/MoreScreen';

export type MoreStackParams = { More: { onLogout: () => void } };
const Stack = createStackNavigator<MoreStackParams>();

export default function MoreStack({ onLogout }: { onLogout: () => void }) {
  const { theme } = useTheme();
  return (
    <Stack.Navigator screenOptions={{
      headerStyle:      { backgroundColor: theme.bgSurface },
      headerTintColor:  theme.fg1,
      headerTitleStyle: { fontWeight: '600', fontSize: 17 },
      cardStyle:        { backgroundColor: theme.bgApp },
    }}>
      <Stack.Screen name="More" options={{ title: 'More' }}>
        {() => <MoreScreen onLogout={onLogout} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
