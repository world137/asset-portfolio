import React, { useCallback, useRef } from 'react';
import {
  ScrollView, View, Text, Pressable, RefreshControl,
  StyleSheet, useWindowDimensions, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useStore }  from '../hooks/useStore';
import { useTheme }  from '../hooks/useTheme';
import Card          from '../components/primitives/Card';
import KpiBox        from '../components/primitives/KpiBox';
import DonutChart    from '../components/charts/DonutChart';
import LineChart     from '../components/charts/LineChart';
import Separator     from '../components/primitives/Separator';
import { fmtMoney, fmtPct, fmtBig, ccySymbol } from '../core/fmt';
import { CLASS_COLORS, ASSET_CLASSES, PRICE_REFRESH_MS } from '../core/constants';
import type { PortfolioStackParams } from '../navigation/stacks/PortfolioStack';

type Nav = StackNavigationProp<PortfolioStackParams, 'Dashboard'>;

export default function DashboardScreen() {
  const nav    = useNavigation<Nav>();
  const Store  = useStore();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = React.useState(false);

  const gt   = Store.grandTotals();
  const snap = Store.getSnapshots();
  const settings = Store.settings();
  const ccy  = settings.displayCcy;
  const sym  = ccySymbol(ccy);

  const donutSlices = gt.classes.map(c => ({
    label: c.label,
    value: c.value,
    color: CLASS_COLORS[c.key] || '#999',
  }));

  const histPoints = snap.slice(-90).map(s => ({ date: s.date, value: typeof s.value === 'number' ? s.value : 0 }));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const last = Store.get().lastPriceSync;
    const stale = !last || Date.now() - last > PRICE_REFRESH_MS;
    if (stale) {
      const { errors } = await Store.refreshPrices();
      if (errors.length) console.warn('price errors:', errors);
      Store.autoSnapshot();
    }
    setRefreshing(false);
  }, [Store]);

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      >
        {/* Grand total */}
        <Card style={s.heroCard}>
          <Text style={s.heroLabel}>Total Portfolio</Text>
          <Text style={s.heroValue}>{sym}{fmtBig(gt.value)}</Text>
          <Text style={[s.heroPnl, { color: gt.profit >= 0 ? theme.success : theme.danger }]}>
            {gt.profit >= 0 ? '+' : ''}{sym}{fmtBig(Math.abs(gt.profit))} ({fmtPct(gt.pct)})
          </Text>
        </Card>

        {/* KPI row */}
        <View style={s.kpiRow}>
          <KpiBox label="Cost" value={sym + fmtBig(gt.cost)} style={s.kpi} />
          <KpiBox label="Classes" value={String(gt.classes.length)} style={s.kpi} />
        </View>

        {/* Donut chart */}
        {donutSlices.length > 0 && (
          <Card style={s.chartCard}>
            <Text style={s.sectionTitle}>Allocation</Text>
            <View style={{ alignItems: 'center', marginVertical: 8 }}>
              <DonutChart
                slices={donutSlices}
                size={Math.min(width - 80, 200)}
                centerLabel={sym + fmtBig(gt.value)}
                centerSub={fmtPct(gt.pct)}
              />
            </View>
            {/* Legend */}
            <View style={s.legend}>
              {gt.classes.map(c => (
                <View key={c.key} style={s.legendRow}>
                  <View style={[s.legendDot, { backgroundColor: CLASS_COLORS[c.key] }]} />
                  <Text style={[s.legendLabel, { color: theme.fg2 }]}>{c.label}</Text>
                  <Text style={[s.legendPct, { color: theme.fg3 }]}>
                    {gt.value ? ((c.value / gt.value) * 100).toFixed(1) : '0'}%
                  </Text>
                  <Text style={[s.legendVal, { color: theme.fg1 }]}>{sym}{fmtBig(c.value)}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* History chart */}
        {histPoints.length > 1 && (
          <Card style={s.chartCard}>
            <Text style={s.sectionTitle}>Portfolio History (90d)</Text>
            <LineChart points={histPoints} width={width - 64} height={120} color={theme.accent} />
          </Card>
        )}

        {/* Per-class list */}
        <Card noPad style={s.classList}>
          <Text style={[s.sectionTitle, { paddingHorizontal: 16, paddingTop: 16 }]}>By Asset Class</Text>
          {ASSET_CLASSES.map((cls, i) => {
            const t = Store.classTotals(cls.key);
            if (!t || (t.value === 0 && t.count === 0)) return null;
            return (
              <Pressable
                key={cls.key}
                onPress={() => nav.navigate('Holdings', { classKey: cls.key, label: cls.label })}
                style={({ pressed }) => [s.classRow, pressed && { opacity: 0.7 }]}
              >
                <View style={[s.classDot, { backgroundColor: CLASS_COLORS[cls.key] }]} />
                <View style={s.classInfo}>
                  <Text style={[s.className, { color: theme.fg1 }]}>{cls.label}</Text>
                  <Text style={[s.classCount, { color: theme.fg3 }]}>{t.count} position{t.count !== 1 ? 's' : ''}</Text>
                </View>
                <View style={s.classRight}>
                  <Text style={[s.classValue, { color: theme.fg1 }]}>{sym}{fmtBig(t.value)}</Text>
                  <Text style={[s.classPct, { color: t.pct >= 0 ? theme.success : theme.danger }]}>
                    {fmtPct(t.pct)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => nav.navigate('Summary')}
            style={({ pressed }) => [s.classRow, { borderBottomWidth: 0 }, pressed && { opacity: 0.7 }]}
          >
            <View style={[s.classDot, { backgroundColor: theme.fg3 }]} />
            <View style={s.classInfo}>
              <Text style={[s.className, { color: theme.fg1 }]}>All Holdings</Text>
              <Text style={[s.classCount, { color: theme.fg3 }]}>Full summary table</Text>
            </View>
            <Text style={[s.classValue, { color: theme.accent, fontSize: 13 }]}>View →</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe:      { flex: 1, backgroundColor: theme.bgApp },
    scroll:    { padding: 16, gap: 12, paddingBottom: 32 },
    heroCard:  { alignItems: 'center', paddingVertical: 24 },
    heroLabel: { fontSize: 12, color: theme.fg3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
    heroValue: { fontSize: 34, fontWeight: '700', color: theme.fg1, marginTop: 4 },
    heroPnl:   { fontSize: 14, marginTop: 4 },
    kpiRow:    { flexDirection: 'row', gap: 10 },
    kpi:       { flex: 1 },
    chartCard: { gap: 4 },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.fg2 },
    legend:    { gap: 6, marginTop: 12 },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { flex: 1, fontSize: 13 },
    legendPct:   { fontSize: 13, minWidth: 40, textAlign: 'right' },
    legendVal:   { fontSize: 13, fontWeight: '600', minWidth: 80, textAlign: 'right' },
    classList:   {},
    classRow:  {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border1,
    },
    classDot:  { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
    classInfo: { flex: 1 },
    className: { fontSize: 14, fontWeight: '600' },
    classCount:{ fontSize: 12, marginTop: 1 },
    classRight:{ alignItems: 'flex-end' },
    classValue:{ fontSize: 14, fontWeight: '600' },
    classPct:  { fontSize: 12, marginTop: 1 },
  });
}
