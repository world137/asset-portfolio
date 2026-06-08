import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '../../hooks/useTheme';
import WalletOverviewScreen  from '../../screens/WalletOverviewScreen';
import TransactionLogScreen  from '../../screens/TransactionLogScreen';
import DebtTrackerScreen     from '../../screens/DebtTrackerScreen';
import WalletSummaryScreen   from '../../screens/WalletSummaryScreen';
import WalletCalendarScreen  from '../../screens/WalletCalendarScreen';
import NetWorthScreen        from '../../screens/NetWorthScreen';

export type WalletStackParams = {
  WalletOverview:  undefined;
  Transactions:    undefined;
  Debts:           undefined;
  WalletSummary:   undefined;
  WalletCalendar:  undefined;
  NetWorth:        undefined;
};

const Stack = createStackNavigator<WalletStackParams>();

export default function WalletStack() {
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
      <Stack.Screen name="WalletOverview" component={WalletOverviewScreen} options={{ title: 'Wallet' }} />
      <Stack.Screen name="Transactions"   component={TransactionLogScreen}  options={{ title: 'Transactions' }} />
      <Stack.Screen name="Debts"          component={DebtTrackerScreen}     options={{ title: 'Debts' }} />
      <Stack.Screen name="WalletSummary"  component={WalletSummaryScreen}   options={{ title: 'Summary' }} />
      <Stack.Screen name="WalletCalendar" component={WalletCalendarScreen}  options={{ title: 'Calendar' }} />
      <Stack.Screen name="NetWorth"       component={NetWorthScreen}        options={{ title: 'Net Worth' }} />
    </Stack.Navigator>
  );
}
