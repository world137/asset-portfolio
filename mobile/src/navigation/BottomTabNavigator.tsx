import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

import PortfolioStack from './stacks/PortfolioStack';
import WalletStack    from './stacks/WalletStack';
import AnalysisStack  from './stacks/AnalysisStack';
import MoreStack      from './stacks/MoreStack';

const Tab = createBottomTabNavigator();

interface Props { onLogout: () => void; }

export default function BottomTabNavigator({ onLogout }: Props) {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   theme.accent,
        tabBarInactiveTintColor: theme.fg3,
        tabBarStyle: {
          backgroundColor: theme.tabBarBg,
          borderTopColor:  theme.tabBarBorder,
          borderTopWidth:  1,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'Portfolio') iconName = focused ? 'pie-chart'         : 'pie-chart-outline';
          if (route.name === 'Wallet')    iconName = focused ? 'wallet'            : 'wallet-outline';
          if (route.name === 'Analysis')  iconName = focused ? 'bar-chart'         : 'bar-chart-outline';
          if (route.name === 'More')      iconName = focused ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Portfolio" options={{ title: 'Portfolio' }}>
        {() => <PortfolioStack />}
      </Tab.Screen>
      <Tab.Screen name="Wallet" options={{ title: 'Wallet' }}>
        {() => <WalletStack />}
      </Tab.Screen>
      <Tab.Screen name="Analysis" options={{ title: 'Analysis' }}>
        {() => <AnalysisStack />}
      </Tab.Screen>
      <Tab.Screen name="More" options={{ title: 'More' }}>
        {() => <MoreStack onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
