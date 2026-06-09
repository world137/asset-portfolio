import React, { useState } from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Card from '../components/primitives/Card';
import KpiBox from '../components/primitives/KpiBox';
import Separator from '../components/primitives/Separator';
import DonutChart from '../components/charts/DonutChart';
import { ccySymbol, fmtBig, fmtPct, fmtQty } from '../core/fmt';
import { ASSET_CLASSES, CLASS_COLORS, SECTOR_PALETTE } from '../core/constants';

interface Row {
  classKey: string; classLabel: string; classColor: string;
  name: string; sector: string; ccy: string;
  qty: number; avgPriceDisp: number; curDisp: number;
  cost: number; value: number; profit: number; pct: number; priceChg: number;
}

export default function SummaryScreen() {
  const Store = useStore();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const settings = Store.settings();
  const disp = settings.displayCcy;
  const sym  = ccySymbol(disp);
  const [filterClass, setFilterClass] = useState('all');

  // Build one row per aggregated position, converting into display currency.
  const rows: Row[] = [];
  for (const cls of ASSET_CLASSES) {
    for (const p of Store.positions(cls.key)) {
      const value   = Store.toDisplay(p.value, cls.ccy);
      const cost    = Store.toDisplay(p.cost,  cls.ccy);
      const curDisp = Store.toDisplay(p.cur ?? p.avgPrice, cls.ccy);
      const avgDisp = Store.toDisplay(p.avgPrice, cls.ccy);
      rows.push({
        classKey: cls.key, classLabel: cls.label, classColor: CLASS_COLORS[cls.key],
        name: p.name, sector: p.sector, ccy: cls.ccy,
        qty: p.qty, avgPriceDisp: avgDisp, curDisp,
        cost, value, profit: value - cost,
        pct: cost ? ((value - cost) / cost) * 100 : 0,
        priceChg: p.avgPrice && p.cur != null ? ((p.cur - p.avgPrice) / p.avgPrice) * 100 : 0,
      });
    }
  }

  const filtered = filterClass === 'all' ? rows : rows.filter(r => r.classKey === filterClass);
  const sorted   = [...filtered].sort((a, b) => b.value - a.value);
  const totalPortValue = sorted.reduce((a, r) => a + r.value, 0) || 1;

  const filtTotals = sorted.reduce(
    (a, r) => ({ cost: a.cost + r.cost, value: a.value + r.value, profit: a.profit + r.profit }),
    { cost: 0, value: 0, profit: 0 });
  const filtPct = filtTotals.cost ? (filtTotals.profit / filtTotals.cost) * 100 : 0;

  const best = sorted.length ? [...sorted].sort((a, b) => b.pct - a.pct)[0] : null;

  // Sector segments (single "Value by Sector" donut)
  const secMap = new Map<string, { cost: number; value: number }>();
  for (const r of filtered) {
    const key   = r.sector || '—';
    const entry = secMap.get(key) || { cost: 0, value: 0 };
    entry.cost += r.cost; entry.value += r.value;
    secMap.set(key, entry);
  }
  const secEntries = [...secMap.entries()].filter(([, e]) => e.value > 0).sort((a, b) => b[1].value - a[1].value);
  const totalSecValue = secEntries.reduce((a, [, e]) => a + e.value, 0) || 1;
  const slices = secEntries.map(([label, e], i) => ({
    label, value: e.value, color: SECTOR_PALETTE[i % SECTOR_PALETTE.length],
  }));

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <Text style={[s.sub, { color: theme.fg3 }]}>
          {rows.length} positions across all asset classes · valued in {disp}
        </Text>

        {/* Class filter segmented control */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.segRow}>
          {[{ key: 'all', short: 'All' }, ...ASSET_CLASSES].map(c => {
            const on = filterClass === c.key;
            return (
              <Pressable key={c.key} onPress={() => setFilterClass(c.key)}
                style={[s.seg, on && { backgroundColor: theme.accent, borderColor: theme.accent }]}>
                <Text style={{ color: on ? '#fff' : theme.fg2, fontSize: 13, fontWeight: '600' }}>{c.short}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* KPI row */}
        <View style={s.kpiRow}>
          <KpiBox label="Current Value" value={sym + fmtBig(filtTotals.value)} accent={theme.accent}
            sub={fmtPct(filtPct) + ' all-time'} subColor={filtPct >= 0 ? theme.success : theme.danger}
            style={s.kpi} />
          <KpiBox label="Total Cost" value={sym + fmtBig(filtTotals.cost)}
            sub={`${sorted.length} positions shown`} style={s.kpi} />
        </View>
        <View style={s.kpiRow}>
          <KpiBox label="Unrealized P/L"
            value={(filtTotals.profit >= 0 ? '+' : '−') + sym + fmtBig(Math.abs(filtTotals.profit))}
            accent={filtTotals.profit >= 0 ? theme.success : theme.danger}
            sub={fmtPct(filtPct)} subColor={filtPct >= 0 ? theme.success : theme.danger}
            style={s.kpi} />
          <KpiBox label="Best Performer"
            value={best ? best.name.replace(/THB$/, '') : '—'}
            sub={best ? fmtPct(best.pct) : undefined}
            subColor={best && best.pct >= 0 ? theme.success : theme.danger}
            style={s.kpi} />
        </View>

        {/* Value by Sector donut */}
        {slices.length > 0 && (
          <Card style={{ alignItems: 'center' }}>
            <Text style={[s.cardTitle, { color: theme.fg1, alignSelf: 'flex-start' }]}>Value by Sector</Text>
            <DonutChart slices={slices} size={Math.min(width - 100, 200)}
              centerLabel={sym + fmtBig(totalSecValue)} centerSub="Value" />
            <View style={{ width: '100%', marginTop: 12, gap: 6 }}>
              {secEntries.map(([label, e], i) => (
                <View key={label} style={s.legendRow}>
                  <View style={[s.legendDot, { backgroundColor: SECTOR_PALETTE[i % SECTOR_PALETTE.length] }]} />
                  <Text style={[s.legendName, { color: theme.fg2 }]} numberOfLines={1}>{label}</Text>
                  <Text style={[s.legendVal, { color: theme.fg1 }]}>{sym}{fmtBig(e.value)}</Text>
                  <Text style={[s.legendPct, { color: theme.fg3 }]}>{((e.value / totalSecValue) * 100).toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Positions list */}
        <Card noPad>
          <Text style={[s.cardTitle, { color: theme.fg1, padding: 16, paddingBottom: 8 }]}>All Positions</Text>
          {sorted.length === 0 && (
            <Text style={{ color: theme.fg3, textAlign: 'center', padding: 20 }}>No holdings found.</Text>
          )}
          {sorted.map((r, idx) => {
            const isUp = r.profit >= 0;
            const portPct = (r.value / totalPortValue) * 100;
            return (
              <View key={r.classKey + ':' + r.name + ':' + idx}>
                {idx > 0 && <Separator mx={16} />}
                <View style={s.posRow}>
                  <View style={[s.classBadge, { backgroundColor: r.classColor }]}>
                    <Text style={s.classBadgeTxt}>{r.classLabel.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.posName, { color: theme.fg1 }]}>{r.name.replace(/THB$/, '')}</Text>
                    <Text style={[s.posMeta, { color: theme.fg3 }]} numberOfLines={1}>
                      {r.classLabel} · {r.sector} · {fmtQty(r.qty)} units
                    </Text>
                    {/* cost vs value bar */}
                    <View style={s.barRow}>
                      <View style={[s.bar, { width: `${Math.min(100, (r.cost / (Math.max(r.cost, r.value) || 1)) * 100)}%`, backgroundColor: theme.fg4 }]} />
                    </View>
                    <View style={s.barRow}>
                      <View style={[s.bar, { width: `${Math.min(100, (r.value / (Math.max(r.cost, r.value) || 1)) * 100)}%`, backgroundColor: isUp ? theme.success : theme.danger, opacity: 0.7 }]} />
                    </View>
                    <Text style={[s.posMeta, { color: theme.fg4 }]}>
                      avg {sym}{fmtBig(r.avgPriceDisp)} → cur {sym}{fmtBig(r.curDisp)} ({r.priceChg >= 0 ? '▲' : '▼'}{Math.abs(r.priceChg).toFixed(1)}%)
                    </Text>
                  </View>
                  <View style={s.posRight}>
                    <Text style={[s.posVal, { color: theme.fg1 }]}>{sym}{fmtBig(r.value)}</Text>
                    <Text style={[s.posCost, { color: theme.fg3 }]}>cost {sym}{fmtBig(r.cost)}</Text>
                    <Text style={[s.posPnl, { color: isUp ? theme.success : theme.danger }]}>
                      {(isUp ? '+' : '−') + sym + fmtBig(Math.abs(r.profit))} ({fmtPct(r.pct)})
                    </Text>
                    <Text style={[s.posCost, { color: theme.fg3 }]}>{portPct.toFixed(1)}% of port</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </Card>

        <PortfolioGrowthPanel theme={theme} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Portfolio Growth Panel ─────────────────────────────────────────────────────
function PortfolioGrowthPanel({ theme }: { theme: ReturnType<typeof useTheme>['theme'] }) {
  const Store = useStore();
  const snapshots = Store.getSnapshots();
  const s = makeStyles(theme);

  if (!snapshots || snapshots.length < 2) {
    return (
      <Card>
        <Text style={[s.cardTitle, { color: theme.fg1 }]}>Portfolio Growth</Text>
        <Text style={{ color: theme.fg3, fontSize: 13, marginTop: 8 }}>
          Not enough snapshot history yet. Returns appear after the portfolio has been open on multiple days.
        </Text>
      </Card>
    );
  }

  const sorted  = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted[sorted.length - 1];
  const now     = new Date();

  function findPast(daysBack?: number, ytd?: boolean, maxPeriod?: boolean): typeof sorted[number] | null {
    if (maxPeriod) return sorted[0];
    if (ytd) {
      const ytdDate = now.getFullYear() + '-01-01';
      return sorted.filter(x => x.date < ytdDate).sort((a, b) => b.date.localeCompare(a.date))[0] || null;
    }
    const target = new Date(now.getTime() - (daysBack || 0) * 86400000).toISOString().slice(0, 10);
    return sorted.filter(x => x.date <= target).sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  }

  const PERIODS: { label: string; days?: number; ytd?: boolean; max?: boolean }[] = [
    { label: '1D', days: 1 }, { label: '5D', days: 5 }, { label: '1M', days: 30 },
    { label: '6M', days: 180 }, { label: 'YTD', ytd: true }, { label: '1Y', days: 365 },
    { label: '5Y', days: 1825 }, { label: 'MAX', max: true },
  ];

  function pct(curr: typeof sorted[number], past: typeof sorted[number], key: string | null): number | null {
    const c = key ? (curr[key] as number ?? null) : (curr.value as number);
    const p = key ? (past[key] as number ?? null) : (past.value as number);
    if (c == null || p == null || p === 0) return null;
    return ((c - p) / p) * 100;
  }

  const classes = ASSET_CLASSES.filter(cls =>
    snapshots.some(x => x[cls.key] != null && (x[cls.key] as number) > 0));

  const cell = (v: number | null, bold?: boolean) => (
    <Text style={[
      s.gCell,
      { color: v == null ? theme.fg4 : v >= 0 ? theme.success : theme.danger },
      bold && { fontWeight: '700' },
    ]}>
      {v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%'}
    </Text>
  );

  return (
    <Card noPad>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <Text style={[s.cardTitle, { color: theme.fg1 }]}>Portfolio Growth</Text>
        <Text style={{ color: theme.fg3, fontSize: 12, marginTop: 2 }}>
          Price return by period · snapshot-based · in THB
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          {/* header */}
          <View style={[s.gRow, { borderBottomColor: theme.border1, borderBottomWidth: 1 }]}>
            <Text style={[s.gHeadLabel, { color: theme.fg3 }]}>Period</Text>
            <Text style={[s.gCell, { color: theme.fg1, fontWeight: '700' }]}>All</Text>
            {classes.map(cls => (
              <View key={cls.key} style={s.gHeadCell}>
                <View style={[s.gDot, { backgroundColor: CLASS_COLORS[cls.key] }]} />
                <Text style={[s.gHead, { color: theme.fg3 }]}>{cls.short || cls.label}</Text>
              </View>
            ))}
          </View>
          {PERIODS.map(({ label, days, ytd, max }) => {
            const past = findPast(days, ytd, max);
            return (
              <View key={label} style={[s.gRow, { borderBottomColor: theme.border1, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                <Text style={[s.gLabel, { color: theme.fg2 }]}>{label}</Text>
                {!past ? (
                  <Text style={[s.gCell, { color: theme.fg4 }]}>No data</Text>
                ) : (
                  <>
                    {cell(pct(current, past, null), true)}
                    {classes.map(cls => <View key={cls.key}>{cell(pct(current, past, cls.key))}</View>)}
                  </>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
      <Text style={{ padding: 12, paddingHorizontal: 16, fontSize: 11, color: theme.fg4 }}>
        Based on {sorted.length} daily snapshots · from {sorted[0].date} · last updated {current.date}
      </Text>
    </Card>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bgApp },
    sub:  { fontSize: 13 },
    segRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
    seg:  { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: theme.bgSurface, borderWidth: 1, borderColor: theme.border1 },
    kpiRow: { flexDirection: 'row', gap: 12 },
    kpi:  { flex: 1 },
    cardTitle: { fontSize: 15, fontWeight: '700' },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendName: { flex: 1, fontSize: 12 },
    legendVal: { fontSize: 12, fontWeight: '600' },
    legendPct: { fontSize: 12, width: 48, textAlign: 'right' },
    posRow: { flexDirection: 'row', gap: 10, padding: 16 },
    classBadge: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    classBadgeTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
    posName: { fontSize: 14, fontWeight: '600' },
    posMeta: { fontSize: 11, marginTop: 2 },
    barRow: { height: 4, borderRadius: 2, backgroundColor: theme.bgSunken, marginTop: 3, overflow: 'hidden' },
    bar:   { height: '100%', borderRadius: 2 },
    posRight: { alignItems: 'flex-end' },
    posVal: { fontSize: 15, fontWeight: '700' },
    posCost: { fontSize: 11, marginTop: 2 },
    posPnl: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    gRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 16 },
    gHeadLabel: { width: 44, fontSize: 11, fontWeight: '700' },
    gLabel: { width: 44, fontSize: 12, fontWeight: '700' },
    gHead: { fontSize: 11 },
    gHeadCell: { width: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
    gCell: { width: 64, fontSize: 12, textAlign: 'right' },
    gDot:  { width: 7, height: 7, borderRadius: 4 },
  });
}
