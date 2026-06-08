import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Card    from '../components/primitives/Card';
import KpiBox  from '../components/primitives/KpiBox';
import LineChart from '../components/charts/LineChart';
import { fmtBig, fmtMoney, ccySymbol } from '../core/fmt';
import { useWindowDimensions } from 'react-native';

export default function WalletSummaryScreen() {
  const Store  = useStore();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const disp   = Store.settings().displayCcy;
  const sym    = ccySymbol(disp);
  const monthly = Store.walletMonthlyData(6);
  const ds     = Store.debtSummary();

  const s = makeStyles(theme);
  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.row}>
          <KpiBox label="Monthly Installment" value={sym + fmtBig(ds.monthlyInstallment)} style={s.kpi} accent={ds.monthlyInstallment > 0 ? theme.danger : undefined} />
          <KpiBox label="Total Lent"           value={sym + fmtBig(ds.totalLent)}         style={s.kpi} accent={theme.success} />
        </View>
        <Card>
          <Text style={[s.sectionTitle, { color: theme.fg2 }]}>Monthly Cash Flow (6 months)</Text>
          <LineChart
            points={monthly.map(m => ({ date: m.month, value: m.income - m.expense }))}
            width={width - 64} height={110} color={theme.accent}
          />
          <View style={s.monthList}>
            {monthly.map(m => (
              <View key={m.month} style={s.monthRow}>
                <Text style={[s.monthLabel, { color: theme.fg3 }]}>{m.label}</Text>
                <Text style={[s.monthInc, { color: theme.success }]}>+{sym}{fmtBig(m.income)}</Text>
                <Text style={[s.monthExp, { color: theme.danger }]}>−{sym}{fmtBig(m.expense)}</Text>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe:  { flex: 1, backgroundColor: theme.bgApp },
    scroll:{ padding: 16, gap: 12, paddingBottom: 32 },
    row:   { flexDirection: 'row', gap: 10 },
    kpi:   { flex: 1 },
    sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
    monthList:{ marginTop: 12, gap: 6 },
    monthRow: { flexDirection: 'row', alignItems: 'center' },
    monthLabel:{ flex: 1, fontSize: 13 },
    monthInc:  { fontSize: 13, fontWeight: '500', minWidth: 80, textAlign: 'right' },
    monthExp:  { fontSize: 13, fontWeight: '500', minWidth: 80, textAlign: 'right' },
  });
}
