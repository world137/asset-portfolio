import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Card from '../components/primitives/Card';
import { fmtBig, ccySymbol } from '../core/fmt';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function WalletCalendarScreen() {
  const Store  = useStore();
  const { theme } = useTheme();
  const now    = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const disp   = Store.settings().displayCcy;
  const sym    = ccySymbol(disp);

  const { income, expense } = Store.monthlyFlow(year, month);
  const net = income - expense;

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Month picker */}
        <Card noPad>
          <View style={s.yearRow}>
            <Pressable onPress={() => setYear(y => y - 1)}><Text style={[s.arrow, { color: theme.fg2 }]}>‹</Text></Pressable>
            <Text style={[s.year, { color: theme.fg1 }]}>{year}</Text>
            <Pressable onPress={() => setYear(y => y + 1)}><Text style={[s.arrow, { color: theme.fg2 }]}>›</Text></Pressable>
          </View>
          <View style={s.monthGrid}>
            {MONTHS.map((m, i) => (
              <Pressable
                key={m}
                onPress={() => setMonth(i + 1)}
                style={[s.monthCell, month === i + 1 && { backgroundColor: theme.accent, borderRadius: 8 }]}
              >
                <Text style={[s.monthCellText, { color: month === i + 1 ? '#fff' : theme.fg2 }]}>{m}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Summary for selected month */}
        <Card>
          <Text style={[s.monthTitle, { color: theme.fg1 }]}>{MONTHS[month - 1]} {year}</Text>
          <View style={s.kpiRow}>
            <View style={s.kpi}>
              <Text style={[s.kpiLabel, { color: theme.fg3 }]}>Income</Text>
              <Text style={[s.kpiVal, { color: theme.success }]}>+{sym}{fmtBig(income)}</Text>
            </View>
            <View style={s.kpi}>
              <Text style={[s.kpiLabel, { color: theme.fg3 }]}>Expense</Text>
              <Text style={[s.kpiVal, { color: theme.danger }]}>−{sym}{fmtBig(expense)}</Text>
            </View>
            <View style={s.kpi}>
              <Text style={[s.kpiLabel, { color: theme.fg3 }]}>Net</Text>
              <Text style={[s.kpiVal, { color: net >= 0 ? theme.success : theme.danger }]}>
                {net >= 0 ? '+' : '−'}{sym}{fmtBig(Math.abs(net))}
              </Text>
            </View>
          </View>
        </Card>

        {/* Category breakdown */}
        {(() => {
          const prefix = `${year}-${String(month).padStart(2, '0')}`;
          const catData = Store.walletCategoryData(prefix);
          const wallet  = Store.getWallet();
          const cats = wallet.categories;
          const expItems = Object.entries(catData.expense)
            .map(([id, v]) => ({ id, v, cat: cats.find(c => c.id === id) }))
            .filter(e => e.v > 0)
            .sort((a, b) => b.v - a.v);
          if (expItems.length === 0) return null;
          return (
            <Card>
              <Text style={[s.sectionTitle, { color: theme.fg2 }]}>Expense by Category</Text>
              {expItems.map(({ id, v, cat }) => (
                <View key={id} style={s.catRow}>
                  <View style={[s.catDot, { backgroundColor: cat?.color || '#999' }]} />
                  <Text style={[s.catName, { color: theme.fg2 }]}>{cat?.name || id}</Text>
                  <Text style={[s.catVal, { color: theme.danger }]}>−{sym}{fmtBig(v)}</Text>
                </View>
              ))}
            </Card>
          );
        })()}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe:    { flex: 1, backgroundColor: theme.bgApp },
    scroll:  { padding: 16, gap: 12, paddingBottom: 32 },
    yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
    arrow:   { fontSize: 24, paddingHorizontal: 16 },
    year:    { fontSize: 18, fontWeight: '700', minWidth: 60, textAlign: 'center' },
    monthGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 4 },
    monthCell: { width: '23%', alignItems: 'center', paddingVertical: 8 },
    monthCellText: { fontSize: 13, fontWeight: '500' },
    monthTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
    kpiRow:  { flexDirection: 'row', gap: 12 },
    kpi:     { flex: 1 },
    kpiLabel:{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    kpiVal:  { fontSize: 20, fontWeight: '700', marginTop: 4 },
    sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
    catRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
    catDot:  { width: 8, height: 8, borderRadius: 4 },
    catName: { flex: 1, fontSize: 14 },
    catVal:  { fontSize: 14, fontWeight: '600' },
  });
}
