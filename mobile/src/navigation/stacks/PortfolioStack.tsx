import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '../../hooks/useTheme';
import DashboardScreen from '../../screens/DashboardScreen';
import HoldingsScreen  from '../../screens/HoldingsScreen';

export type PortfolioStackParams = {
  Dashboard: undefined;
  Holdings:  { classKey: string; label: string };
};

const Stack = createStackNavigator<PortfolioStackParams>();

export default function PortfolioStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle:        { backgroundColor: theme.bgSurface },
        headerTintColor:    theme.fg1,
        headerTitleStyle:   { fontWeight: '600', fontSize: 17 },
        cardStyle:          { backgroundColor: theme.bgApp },
      }}
    >
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Portfolio' }} />
      <Stack.Screen
        name="Holdings"
        component={HoldingsScreen}
        options={({ route }) => ({ title: route.params.label })}
      />
    </Stack.Navigator>
  );
}
