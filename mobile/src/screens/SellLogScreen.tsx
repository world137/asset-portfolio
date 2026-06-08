import React from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Card from '../components/primitives/Card';
import Separator from '../components/primitives/Separator';
import { fmtMoney, fmtPct, fmtDate, ccySymbol, fmtBig } from '../core/fmt';

export default function SellLogScreen() {
  const Store   = useStore();
  const { theme } = useTheme();
  const summary = Store.salesSummary();
  const sales   = Store.getSales();
  const disp    = Store.settings().displayCcy;
  const sym     = ccySymbol(disp);

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <FlatList
        data={summary}
        keyExtractor={y => y.year}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        ListEmptyComponent={
          <Card><Text style={{ color: theme.fg3, textAlign: 'center' }}>No sales recorded yet.</Text></Card>
        }
        renderItem={({ item: y }) => {
          const yearSales = sales.filter(s => s.date.startsWith(y.year));
          return (
            <Card noPad>
              {/* Year header */}
              <View style={s.yearHeader}>
                <Text style={[s.year, { color: theme.fg1 }]}>{y.year}</Text>
                <View style={s.yearRight}>
                  <Text style={[s.yearPnl, { color: y.pnl >= 0 ? theme.success : theme.danger }]}>
                    {y.pnl >= 0 ? '+' : ''}{sym}{fmtBig(Math.abs(y.pnl))}
                  </Text>
                  <Text style={[s.yearPct, { color: y.pnlPct >= 0 ? theme.success : theme.danger }]}>
                    {fmtPct(y.pnlPct)}
                  </Text>
                </View>
              </View>
              <Separator />
              {/* Individual sales */}
              {yearSales.map((sale, i) => (
                <View key={sale.id}>
                  <View style={s.saleRow}>
                    <View style={s.saleInfo}>
                      <Text style={[s.saleName, { color: theme.fg1 }]}>{sale.name}</Text>
                      <Text style={[s.saleMeta, { color: theme.fg3 }]}>
                        {fmtDate(sale.date)} · {sale.qty} units
                      </Text>
                      <Text style={[s.salePrices, { color: theme.fg3 }]}>
                        Buy {fmtMoney(sale.buyPrice, sale.ccy)} → Sell {fmtMoney(sale.sellPrice, sale.ccy)}
                      </Text>
                    </View>
                    <View style={s.salePnl}>
                      <Text style={[s.salePnlVal, { color: sale.realizedPnl >= 0 ? theme.success : theme.danger }]}>
                        {sale.realizedPnl >= 0 ? '+' : ''}{fmtMoney(sale.realizedPnl, sale.ccy)}
                      </Text>
                      <Text style={[s.salePnlPct, { color: sale.pnlPct >= 0 ? theme.success : theme.danger }]}>
                        {fmtPct(sale.pnlPct)}
                      </Text>
                    </View>
                  </View>
                  {i < yearSales.length - 1 && <Separator mx={16} />}
                </View>
              ))}
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe:      { flex: 1, backgroundColor: theme.bgApp },
    yearHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
    year:      { fontSize: 17, fontWeight: '700' },
    yearRight: { alignItems: 'flex-end' },
    yearPnl:   { fontSize: 16, fontWeight: '700' },
    yearPct:   { fontSize: 12, marginTop: 1 },
    saleRow:   { flexDirection: 'row', padding: 14, gap: 12 },
    saleInfo:  { flex: 1 },
    saleName:  { fontSize: 14, fontWeight: '600' },
    saleMeta:  { fontSize: 12, marginTop: 2 },
    salePrices:{ fontSize: 11, marginTop: 2 },
    salePnl:   { alignItems: 'flex-end' },
    salePnlVal:{ fontSize: 14, fontWeight: '700' },
    salePnlPct:{ fontSize: 12, marginTop: 2 },
  });
}
