import React from 'react';
import { FlatList, Text, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import type { AnalysisStackParams } from '../navigation/stacks/AnalysisStack';

type Nav = StackNavigationProp<AnalysisStackParams, 'AnalysisHub'>;

type MenuItem = {
  label: string;
  screen: keyof Omit<AnalysisStackParams, 'AnalysisHub'>;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
};

const MENU_ITEMS: MenuItem[] = [
  { label: 'Sectors',           screen: 'Sectors',    icon: 'pie-chart-outline',      description: 'Allocation by sector' },
  { label: 'Summary',           screen: 'Summary',    icon: 'list-outline',           description: 'Full holdings table' },
  { label: 'Day Report',        screen: 'DayReport',  icon: 'trending-up-outline',    description: 'Top movers today' },
  { label: 'Benchmark',         screen: 'Benchmark',  icon: 'bar-chart-outline',      description: 'Compare vs indices' },
  { label: 'Risk',              screen: 'Risk',       icon: 'shield-outline',         description: 'Sharpe, drawdown & volatility' },
  { label: 'Rebalancing',       screen: 'Rebalancing',icon: 'git-branch-outline',     description: 'Target allocation drift' },
  { label: 'Planning',          screen: 'Planning',   icon: 'calculator-outline',     description: 'DCA & contribution simulator' },
  { label: 'Goals',             screen: 'Goals',      icon: 'flag-outline',           description: 'Investment targets' },
  { label: 'Dividends',         screen: 'Dividends',  icon: 'cash-outline',           description: 'Dividend calendar & income' },
  { label: 'Price Alerts',      screen: 'Alerts',     icon: 'notifications-outline',  description: 'Above/below price triggers' },
  { label: 'Watchlist',         screen: 'Watchlist',  icon: 'eye-outline',            description: 'Tickers to monitor' },
  { label: 'Technical Analysis',screen: 'Technical',  icon: 'analytics-outline',      description: 'EMA, RSI, MACD, Bollinger' },
  { label: 'Sell Log',          screen: 'SellLog',    icon: 'receipt-outline',        description: 'Realized P&L history' },
];

export default function AnalysisHubScreen() {
  const nav = useNavigation<Nav>();
  const { theme } = useTheme();
  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <FlatList
        data={MENU_ITEMS}
        keyExtractor={item => item.screen}
        contentContainerStyle={s.list}
        ItemSeparatorComponent={() => <View style={s.separator} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => nav.navigate(item.screen as any)}
            style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
          >
            <View style={[s.iconWrap, { backgroundColor: theme.accent + '18' }]}>
              <Ionicons name={item.icon} size={20} color={theme.accent} />
            </View>
            <View style={s.textWrap}>
              <Text style={[s.label, { color: theme.fg1 }]}>{item.label}</Text>
              <Text style={[s.desc, { color: theme.fg3 }]}>{item.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.fg4} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe:      { flex: 1, backgroundColor: theme.bgApp },
    list:      { padding: 16, paddingBottom: 32 },
    row:       {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: theme.bgSurface,
      borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    },
    separator: { height: 8 },
    iconWrap:  { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    textWrap:  { flex: 1 },
    label:     { fontSize: 15, fontWeight: '600' },
    desc:      { fontSize: 12, marginTop: 2 },
  });
}
