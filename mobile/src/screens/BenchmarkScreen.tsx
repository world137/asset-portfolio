import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Card    from '../components/primitives/Card';
import LineChart from '../components/charts/LineChart';
import Separator from '../components/primitives/Separator';
import { ccySymbol } from '../core/fmt';
import { API_BASE } from '../core/constants';

const BENCHMARK_OPTIONS = [
  { key: 'set',   label: 'SET (Thailand)' },
  { key: 'sp500', label: 'S&P 500' },
  { key: 'ndx',   label: 'NASDAQ-100' },
  { key: 'dji',   label: 'Dow Jones' },
  { key: 'msci',  label: 'MSCI World ETF' },
];

const RANGE_OPTIONS = [
  { key: '1mo', label: '1M' },
  { key: '3mo', label: '3M' },
  { key: '6mo', label: '6M' },
  { key: '1y',  label: '1Y' },
  { key: '2y',  label: '2Y' },
  { key: '5y',  label: '5Y' },
];

const BENCH_COLORS: Record<string, string> = {
  set:   '#ef4444',
  sp500: '#3b82f6',
  ndx:   '#8b5cf6',
  dji:   '#f59e0b',
  msci:  '#06b6d4',
};

const CUTOFF_DAYS: Record<string, number> = {
  '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365, '2y': 730, '5y': 1825,
};

interface NormPoint { date: string; value: number; }
interface BenchPoint { date: string; close?: number; value?: number; }
interface Series { key: string; label: string; color: string; points: NormPoint[]; }

function buildNormalized(points: BenchPoint[] | undefined): NormPoint[] {
  if (!points || points.length === 0) return [];
  const base = points[0].close ?? points[0].value;
  if (!base) return [];
  return points.map(p => ({ date: p.date, value: ((p.close ?? p.value ?? 0) / base) * 100 }));
}

function totalReturn(points: NormPoint[]): number | null {
  if (!points || points.length < 2) return null;
  return points[points.length - 1].value - 100;
}

export default function BenchmarkScreen() {
  const Store = useStore();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const settings = Store.settings();
  const snapshots = Store.getSnapshots();

  const [range, setRange] = React.useState('1y');
  const [selected, setSelected] = React.useState<Set<string>>(new Set(['set', 'sp500']));
  const [benchData, setBenchData] = React.useState<Record<string, { label: string; points: BenchPoint[] }>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedKey = [...selected].sort().join(',');

  function toggleBench(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  }

  React.useEffect(() => {
    if (selected.size === 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const symbols = [...selected].join(',');
    fetch(`${API_BASE}/api/benchmark?range=${range}&symbols=${symbols}`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(j => { if (!cancelled) { setBenchData(j.benchmarks || {}); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError('Failed to load benchmark data.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [range, selectedKey]);

  // Portfolio series normalized to 100
  const portSorted = [...(snapshots || [])].sort((a, b) => a.date.localeCompare(b.date));
  const days = CUTOFF_DAYS[range];
  const cutoff = days ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10) : null;
  const filteredPort = cutoff ? portSorted.filter(s => s.date >= cutoff) : portSorted;
  const portNorm = buildNormalized(filteredPort.map(s => ({ date: s.date, close: typeof s.value === 'number' ? s.value : 0 })));

  const allSeries: Series[] = [
    { key: 'portfolio', label: 'My Portfolio', color: theme.success, points: portNorm },
    ...[...selected].map(key => {
      const bm = benchData[key];
      if (!bm) return null;
      const norm = buildNormalized(bm.points);
      return { key, label: bm.label, color: BENCH_COLORS[key] || '#888', points: norm } as Series;
    }).filter((x): x is Series => x !== null),
  ].filter(sx => sx.points && sx.points.length > 0);

  const portRet = totalReturn(portNorm);
  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.subtitle}>Portfolio performance vs market indices · normalized to 100 at start of period</Text>

        {/* Range selector */}
        <View style={s.segRow}>
          {RANGE_OPTIONS.map(r => {
            const on = range === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setRange(r.key)}
                style={[s.seg, { backgroundColor: on ? theme.accent : theme.bgSunken }]}
              >
                <Text style={[s.segTxt, { color: on ? theme.fgOnCopper : theme.fg3 }]}>{r.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Benchmark toggles */}
        <View style={s.pillRow}>
          {BENCHMARK_OPTIONS.map(b => {
            const on = selected.has(b.key);
            const c = BENCH_COLORS[b.key];
            return (
              <Pressable
                key={b.key}
                onPress={() => toggleBench(b.key)}
                style={[s.benchPill, { borderColor: on ? c : theme.border1, backgroundColor: on ? c + '22' : 'transparent' }]}
              >
                <Text style={[s.benchTxt, { color: on ? c : theme.fg3, fontWeight: on ? '700' : '400' }]}>{b.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Chart: portfolio normalized line (LineChart) */}
        <Card style={{ gap: 8 }}>
          <Text style={s.sectionTitle}>Portfolio (normalized to 100)</Text>
          {portNorm.length > 1 ? (
            <LineChart points={portNorm} width={width - 64} height={160} color={theme.success} />
          ) : (
            <Text style={s.note}>Not enough portfolio history for this period.</Text>
          )}
          {loading && <Text style={s.note}>Loading benchmark data…</Text>}
          {error && <Text style={[s.note, { color: theme.danger }]}>{error}</Text>}

          {/* Legend with returns */}
          <View style={s.legend}>
            {allSeries.map(ser => {
              const ret = totalReturn(ser.points);
              return (
                <View key={ser.key} style={s.legendRow}>
                  <View style={[s.legendBar, { backgroundColor: ser.color, width: ser.key === 'portfolio' ? 16 : 12 }]} />
                  <Text style={[s.legendLabel, { color: ser.key === 'portfolio' ? theme.fg1 : theme.fg2, fontWeight: ser.key === 'portfolio' ? '700' : '400' }]}>
                    {ser.label}
                  </Text>
                  {ret !== null && (
                    <Text style={[s.legendRet, { color: ret >= 0 ? theme.success : theme.danger }]}>
                      {ret >= 0 ? '+' : ''}{ret.toFixed(1)}%
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </Card>

        {/* Performance comparison */}
        <Card>
          <Text style={s.sectionTitle}>Performance Comparison</Text>
          <Text style={s.subSmall}>Total return over selected period</Text>
          {allSeries.map((ser, i) => {
            const ret = totalReturn(ser.points);
            const alpha = (ret !== null && portRet !== null && ser.key !== 'portfolio') ? ret - portRet : null;
            const barPct = ret !== null ? Math.min(100, Math.abs(ret)) : 0;
            return (
              <View key={ser.key}>
                {i > 0 && <Separator />}
                <View style={s.compRow}>
                  <View style={s.compHead}>
                    <View style={[s.dot, { backgroundColor: ser.color }]} />
                    <Text style={[s.compLabel, { color: theme.fg1, fontWeight: ser.key === 'portfolio' ? '700' : '500' }]}>{ser.label}</Text>
                    <Text style={[s.compRet, { color: ret === null ? theme.fg3 : ret >= 0 ? theme.success : theme.danger }]}>
                      {ret === null ? '—' : (ret >= 0 ? '+' : '') + ret.toFixed(2) + '%'}
                    </Text>
                  </View>
                  <View style={s.barTrack}>
                    <View style={[s.barFill, { width: `${barPct}%`, backgroundColor: ret !== null && ret >= 0 ? theme.success : theme.danger }]} />
                  </View>
                  <View style={s.compMeta}>
                    <Text style={[s.metaTxt, { color: theme.fg3 }]}>
                      End {ret !== null ? (100 + ret).toFixed(1) : '—'}
                    </Text>
                    {alpha !== null && (
                      <Text style={[s.metaTxt, { color: alpha >= 0 ? theme.success : theme.danger }]}>
                        vs Portfolio {alpha >= 0 ? '+' : ''}{alpha.toFixed(2)}%
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe:     { flex: 1, backgroundColor: theme.bgApp },
    scroll:   { padding: 16, gap: 12, paddingBottom: 32 },
    subtitle: { fontSize: 12, color: theme.fg3 },
    segRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    seg:      { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
    segTxt:   { fontSize: 12, fontWeight: '600' },
    pillRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    benchPill:{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 2 },
    benchTxt: { fontSize: 12 },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.fg2 },
    subSmall: { fontSize: 11, color: theme.fg3, marginTop: 2, marginBottom: 8 },
    note:     { fontSize: 12, color: theme.fg3, paddingVertical: 4 },
    legend:   { gap: 6, marginTop: 4 },
    legendRow:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
    legendBar:{ height: 3, borderRadius: 2 },
    legendLabel: { flex: 1, fontSize: 12 },
    legendRet: { fontSize: 11, fontWeight: '700' },
    compRow:  { paddingVertical: 10, gap: 6 },
    compHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot:      { width: 10, height: 10, borderRadius: 5 },
    compLabel:{ flex: 1, fontSize: 14 },
    compRet:  { fontSize: 14, fontWeight: '700' },
    barTrack: { height: 8, borderRadius: 4, backgroundColor: theme.bgSunken, overflow: 'hidden' },
    barFill:  { height: '100%', borderRadius: 4 },
    compMeta: { flexDirection: 'row', justifyContent: 'space-between' },
    metaTxt:  { fontSize: 11 },
  });
}
