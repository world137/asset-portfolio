import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Card from '../components/primitives/Card';
import Separator from '../components/primitives/Separator';
import { fmtPct, fmtPrice } from '../core/fmt';
import { ASSET_CLASSES } from '../core/constants';

export default function DayReportScreen() {
  const Store   = useStore();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  const state = Store.get();

  // Collect positions with day change
  const movers: { name: string; classKey: string; cur: number; dayPct: number; ccy: string }[] = [];
  for (const cls of ASSET_CLASSES) {
    for (const pos of Store.positions(cls.key)) {
      const pct = Store.dayChangePct(cls.key, pos.name);
      if (pct == null) continue;
      movers.push({ name: pos.name, classKey: cls.key, cur: pos.cur || 0, dayPct: pct, ccy: cls.ccy });
    }
  }
  movers.sort((a, b) => Math.abs(b.dayPct) - Math.abs(a.dayPct));
  const gainers  = movers.filter(m => m.dayPct > 0).slice(0, 10);
  const losers   = movers.filter(m => m.dayPct < 0).slice(0, 10);

  async function refresh() {
    setLoading(true);
    await Store.refreshPrices();
    setLoading(false);
  }

  const s = makeStyles(theme);
  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.accent} />}
      >
        {loading && <ActivityIndicator color={theme.accent} />}

        {movers.length === 0 && !loading && (
          <Card><Text style={{ color: theme.fg3, textAlign: 'center' }}>Pull down to refresh prices for day change data.</Text></Card>
        )}

        {gainers.length > 0 && (
          <Card noPad>
            <Text style={[s.header, { color: theme.fg1 }]}>Top Gainers</Text>
            {gainers.map((m, i) => (
              <View key={m.name + m.classKey}>
                {i > 0 && <Separator mx={16} />}
                <View style={s.row}>
                  <View style={s.info}>
                    <Text style={[s.name, { color: theme.fg1 }]}>{m.name}</Text>
                    <Text style={[s.cls,  { color: theme.fg3 }]}>{m.classKey}</Text>
                  </View>
                  <View style={s.right}>
                    <Text style={[s.price, { color: theme.fg2 }]}>{fmtPrice(m.cur, m.ccy)}</Text>
                    <Text style={[s.pct, { color: theme.success }]}>{fmtPct(m.dayPct)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        )}

        {losers.length > 0 && (
          <Card noPad>
            <Text style={[s.header, { color: theme.fg1 }]}>Top Losers</Text>
            {losers.map((m, i) => (
              <View key={m.name + m.classKey}>
                {i > 0 && <Separator mx={16} />}
                <View style={s.row}>
                  <View style={s.info}>
                    <Text style={[s.name, { color: theme.fg1 }]}>{m.name}</Text>
                    <Text style={[s.cls,  { color: theme.fg3 }]}>{m.classKey}</Text>
                  </View>
                  <View style={s.right}>
                    <Text style={[s.price, { color: theme.fg2 }]}>{fmtPrice(m.cur, m.ccy)}</Text>
                    <Text style={[s.pct, { color: theme.danger }]}>{fmtPct(m.dayPct)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe:   { flex: 1, backgroundColor: theme.bgApp },
    scroll: { padding: 16, gap: 12, paddingBottom: 32 },
    header: { fontSize: 14, fontWeight: '700', padding: 14, paddingBottom: 8 },
    row:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    info:   { flex: 1 },
    name:   { fontSize: 14, fontWeight: '600' },
    cls:    { fontSize: 11, marginTop: 1 },
    right:  { alignItems: 'flex-end' },
    price:  { fontSize: 13 },
    pct:    { fontSize: 15, fontWeight: '700', marginTop: 1 },
  });
}
