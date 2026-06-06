import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Card    from '../components/primitives/Card';
import KpiBox  from '../components/primitives/KpiBox';
import Separator from '../components/primitives/Separator';
import { fmtMoney, fmtBig, ccySymbol } from '../core/fmt';

export default function NetWorthScreen() {
  const Store  = useStore();
  const { theme } = useTheme();
  const nw = Store.netWorthSummary();
  const disp = Store.settings().displayCcy;
  const sym  = ccySymbol(disp);
  const wallet = Store.getWallet();

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Total */}
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Text style={s.label}>Net Worth</Text>
          <Text style={s.bigVal}>{sym}{fmtBig(nw.netWorth)}</Text>
        </Card>

        {/* KPI row */}
        <View style={s.row}>
          <KpiBox label="Assets" value={sym + fmtBig(nw.totalAssets)} style={s.kpi} />
          <KpiBox label="Liabilities" value={sym + fmtBig(nw.totalLiabilities)} style={s.kpi} accent={theme.danger} />
        </View>

        {/* Breakdown */}
        <Card>
          <Text style={s.sectionTitle}>Breakdown</Text>
          {[
            { label: 'Portfolio',    value: nw.portValue,    positive: true },
            { label: 'Cash & Banks', value: nw.cashTotal,    positive: true },
            { label: 'Credit Debt',  value: -nw.creditDebt,  positive: false },
            { label: 'Loans',        value: -nw.borrowedDebt,positive: false },
          ].map((row, i) => (
            <View key={row.label}>
              {i > 0 && <Separator />}
              <View style={s.breakRow}>
                <Text style={[s.breakLabel, { color: theme.fg2 }]}>{row.label}</Text>
                <Text style={[s.breakValue, { color: row.value >= 0 ? theme.fg1 : theme.danger }]}>
                  {row.value >= 0 ? '' : '−'}{sym}{fmtBig(Math.abs(row.value))}
                </Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Accounts */}
        {wallet.accounts.filter(a => !a.archived).length > 0 && (
          <Card>
            <Text style={s.sectionTitle}>Accounts</Text>
            {wallet.accounts.filter(a => !a.archived).map((acc, i) => {
              const bal = Store.accountBalance(acc.id);
              return (
                <View key={acc.id}>
                  {i > 0 && <Separator />}
                  <View style={s.breakRow}>
                    <View style={[s.accDot, { backgroundColor: acc.color }]} />
                    <Text style={[s.breakLabel, { color: theme.fg2, flex: 1 }]}>{acc.name}</Text>
                    <Text style={[s.breakValue, { color: bal >= 0 ? theme.fg1 : theme.danger }]}>
                      {bal < 0 ? '−' : ''}{fmtMoney(Math.abs(bal), acc.currency)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe:       { flex: 1, backgroundColor: theme.bgApp },
    scroll:     { padding: 16, gap: 12, paddingBottom: 32 },
    label:      { fontSize: 12, color: theme.fg3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
    bigVal:     { fontSize: 36, fontWeight: '700', color: theme.fg1, marginTop: 4 },
    row:        { flexDirection: 'row', gap: 10 },
    kpi:        { flex: 1 },
    sectionTitle:{ fontSize: 13, fontWeight: '600', color: theme.fg2, marginBottom: 12 },
    breakRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
    breakLabel: { flex: 1, fontSize: 14 },
    breakValue: { fontSize: 15, fontWeight: '600' },
    accDot:     { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  });
}
