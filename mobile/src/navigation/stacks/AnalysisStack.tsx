import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '../../hooks/useTheme';
import AnalysisHubScreen  from '../../screens/AnalysisHubScreen';
import SectorScreen       from '../../screens/SectorScreen';
import SellLogScreen      from '../../screens/SellLogScreen';
import WatchlistScreen    from '../../screens/WatchlistScreen';
import TechnicalScreen    from '../../screens/TechnicalScreen';
import DayReportScreen    from '../../screens/DayReportScreen';
import BenchmarkScreen    from '../../screens/BenchmarkScreen';
import RiskScreen         from '../../screens/RiskScreen';
import AlertsScreen       from '../../screens/AlertsScreen';
import GoalsScreen        from '../../screens/GoalsScreen';
import PlanningScreen     from '../../screens/PlanningScreen';
import RebalancingScreen  from '../../screens/RebalancingScreen';
import DividendsScreen    from '../../screens/DividendsScreen';
import SummaryScreen      from '../../screens/SummaryScreen';

export type AnalysisStackParams = {
  AnalysisHub: undefined;
  Sectors:     undefined;
  SellLog:     undefined;
  Watchlist:   undefined;
  Technical:   undefined;
  DayReport:   undefined;
  Benchmark:   undefined;
  Risk:        undefined;
  Alerts:      undefined;
  Goals:       undefined;
  Planning:    undefined;
  Rebalancing: undefined;
  Dividends:   undefined;
  Summary:     undefined;
};

const Stack = createStackNavigator<AnalysisStackParams>();

export default function AnalysisStack() {
  const { theme } = useTheme();
  const screenOptions = {
    headerStyle:      { backgroundColor: theme.bgSurface },
    headerTintColor:  theme.fg1,
    headerTitleStyle: { fontWeight: '600' as const, fontSize: 17 },
    cardStyle:        { backgroundColor: theme.bgApp },
  };
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="AnalysisHub"  component={AnalysisHubScreen}  options={{ title: 'Analysis' }} />
      <Stack.Screen name="Sectors"      component={SectorScreen}        options={{ title: 'Sectors' }} />
      <Stack.Screen name="Summary"      component={SummaryScreen}       options={{ title: 'Summary' }} />
      <Stack.Screen name="DayReport"    component={DayReportScreen}     options={{ title: 'Day Report' }} />
      <Stack.Screen name="Benchmark"    component={BenchmarkScreen}     options={{ title: 'Benchmark' }} />
      <Stack.Screen name="Risk"         component={RiskScreen}          options={{ title: 'Risk' }} />
      <Stack.Screen name="Rebalancing"  component={RebalancingScreen}   options={{ title: 'Rebalancing' }} />
      <Stack.Screen name="Planning"     component={PlanningScreen}      options={{ title: 'Planning' }} />
      <Stack.Screen name="Goals"        component={GoalsScreen}         options={{ title: 'Goals' }} />
      <Stack.Screen name="Dividends"    component={DividendsScreen}     options={{ title: 'Dividends' }} />
      <Stack.Screen name="Alerts"       component={AlertsScreen}        options={{ title: 'Price Alerts' }} />
      <Stack.Screen name="Watchlist"    component={WatchlistScreen}     options={{ title: 'Watchlist' }} />
      <Stack.Screen name="Technical"    component={TechnicalScreen}     options={{ title: 'Technical Analysis' }} />
      <Stack.Screen name="SellLog"      component={SellLogScreen}       options={{ title: 'Sell Log' }} />
    </Stack.Navigator>
  );
}
