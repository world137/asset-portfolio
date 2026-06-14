import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '../../hooks/useTheme';
import WalletOverviewScreen  from '../../screens/WalletOverviewScreen';
import TransactionLogScreen  from '../../screens/TransactionLogScreen';
import DebtTrackerScreen     from '../../screens/DebtTrackerScreen';
import WalletSummaryScreen   from '../../screens/WalletSummaryScreen';
import WalletCalendarScreen  from '../../screens/WalletCalendarScreen';
import NetWorthScreen        from '../../screens/NetWorthScreen';
import BillsScreen           from '../../screens/BillsScreen';
import SavingsGoalsScreen    from '../../screens/SavingsGoalsScreen';
import ReconcileScreen       from '../../screens/ReconcileScreen';

export type WalletStackParams = {
  WalletOverview:  undefined;
  Transactions:    undefined;
  Debts:           undefined;
  WalletSummary:   undefined;
  WalletCalendar:  undefined;
  NetWorth:        undefined;
  Bills:           undefined;
  SavingsGoals:    undefined;
  Reconcile:       undefined;
};

const Stack = createStackNavigator<WalletStackParams>();

export default function WalletStack() {
  const { theme } = useTheme();
  const screenOptions = {
    headerStyle:      { backgroundColor: theme.bgSurface },
    headerTintColor:  theme.fg1,
    headerTitleStyle: { fontWeight: '600' as const, fontSize: 17 },
    cardStyle:        { backgroundColor: theme.bgApp },
  };
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="WalletOverview" component={WalletOverviewScreen} options={{ title: 'Wallet' }} />
      <Stack.Screen name="Transactions"   component={TransactionLogScreen}  options={{ title: 'Transactions' }} />
      <Stack.Screen name="Debts"          component={DebtTrackerScreen}     options={{ title: 'Debts' }} />
      <Stack.Screen name="WalletSummary"  component={WalletSummaryScreen}   options={{ title: 'Summary' }} />
      <Stack.Screen name="WalletCalendar" component={WalletCalendarScreen}  options={{ title: 'Calendar' }} />
      <Stack.Screen name="NetWorth"       component={NetWorthScreen}        options={{ title: 'Net Worth' }} />
      <Stack.Screen name="Bills"          component={BillsScreen}           options={{ title: 'Bills' }} />
      <Stack.Screen name="SavingsGoals"   component={SavingsGoalsScreen}    options={{ title: 'Savings Goals' }} />
      <Stack.Screen name="Reconcile"      component={ReconcileScreen}       options={{ title: 'Reconcile' }} />
    </Stack.Navigator>
  );
}
