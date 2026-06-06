import React from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Card     from '../components/primitives/Card';
import DonutChart from '../components/charts/DonutChart';
import { fmtMoney, fmtPct, ccySymbol, fmtBig } from '../core/fmt';
import { SECTOR_PALETTE } from '../core/constants';
import { useWindowDimensions } from 'react-native';

export default function SectorScreen() {
  const Store  = useStore();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const sectors = Store.sectorTotals();
  const disp    = Store.settings().displayCcy;
  const sym     = ccySymbol(disp);
  const total   = sectors.reduce((s, x) => s + x.value, 0);

  const slices = sectors.map((s, i) => ({
    label: s.sector, value: s.value, color: SECTOR_PALETTE[i % SECTOR_PALETTE.length],
  }));

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <FlatList
        data={sectors}
        keyExtractor={s => s.sector}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        ListHeaderComponent={
          slices.length > 0 ? (
            <Card style={{ alignItems: 'center', marginBottom: 4 }}>
              <DonutChart slices={slices} size={Math.min(width - 80, 200)} centerLabel={sym + fmtBig(total)} />
            </Card>
          ) : null
        }
        ListEmptyComponent={
          <Card><Text style={{ color: theme.fg3, textAlign: 'center' }}>No sector data yet.</Text></Card>
        }
        renderItem={({ item: sec, index }) => {
          const color = SECTOR_PALETTE[index % SECTOR_PALETTE.length];
          const pct   = total ? (sec.value / total) * 100 : 0;
          const gain  = sec.value - sec.cost;
          return (
            <Card style={s.row}>
              <View style={[s.dot, { backgroundColor: color }]} />
              <View style={s.info}>
                <Text style={[s.sector, { color: theme.fg1 }]}>{sec.sector}</Text>
                <Text style={[s.pctBar, { color: theme.fg3 }]}>{pct.toFixed(1)}%</Text>
              </View>
              <View style={s.right}>
                <Text style={[s.val, { color: theme.fg1 }]}>{sym}{fmtBig(sec.value)}</Text>
                <Text style={[s.gain, { color: gain >= 0 ? theme.success : theme.danger }]}>{fmtPct(sec.cost ? gain / sec.cost * 100 : 0)}</Text>
              </View>
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bgApp },
    row:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dot:  { width: 10, height: 10, borderRadius: 5 },
    info: { flex: 1 },
    sector:{ fontSize: 14, fontWeight: '600' },
    pctBar:{ fontSize: 12, marginTop: 2 },
    right: { alignItems: 'flex-end' },
    val:   { fontSize: 15, fontWeight: '600' },
    gain:  { fontSize: 12, marginTop: 2 },
  });
}
