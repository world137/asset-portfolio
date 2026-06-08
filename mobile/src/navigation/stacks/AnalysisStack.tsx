import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '../../hooks/useTheme';
import SectorScreen    from '../../screens/SectorScreen';
import SellLogScreen   from '../../screens/SellLogScreen';
import WatchlistScreen from '../../screens/WatchlistScreen';
import TechnicalScreen from '../../screens/TechnicalScreen';
import DayReportScreen from '../../screens/DayReportScreen';

export type AnalysisStackParams = {
  Sectors:   undefined;
  SellLog:   undefined;
  Watchlist: undefined;
  Technical: undefined;
  DayReport: undefined;
};

const Stack = createStackNavigator<AnalysisStackParams>();

export default function AnalysisStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle:      { backgroundColor: theme.bgSurface },
        headerTintColor:  theme.fg1,
        headerTitleStyle: { fontWeight: '600', fontSize: 17 },
        cardStyle:        { backgroundColor: theme.bgApp },
      }}
    >
      <Stack.Screen name="Sectors"   component={SectorScreen}    options={{ title: 'Sectors' }} />
      <Stack.Screen name="SellLog"   component={SellLogScreen}   options={{ title: 'Sell Log' }} />
      <Stack.Screen name="Watchlist" component={WatchlistScreen} options={{ title: 'Watchlist' }} />
      <Stack.Screen name="Technical" component={TechnicalScreen} options={{ title: 'Technical' }} />
      <Stack.Screen name="DayReport" component={DayReportScreen} options={{ title: 'Day Report' }} />
    </Stack.Navigator>
  );
}
