import React from 'react';
import { ScrollView, View, Text, Pressable, TextInput, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Card    from '../components/primitives/Card';
import KpiBox  from '../components/primitives/KpiBox';
import LineChart from '../components/charts/LineChart';
import Separator from '../components/primitives/Separator';
import { ccySymbol, fmtBig } from '../core/fmt';
import { ASSET_CLASSES, CLASS_COLORS } from '../core/constants';

// ── Math helpers (ported from RiskView.jsx) ──────────────────────────────────
function computeReturns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) out.push((values[i] - values[i - 1]) / values[i - 1]);
  }
  return out;
}
function mean(arr: number[]): number { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, x) => a + (x - m) ** 2, 0) / (arr.length - 1));
}
function sharpe(returns: number[], riskFree = 0): number | null {
  if (returns.length < 2) return null;
  const m = mean(returns); const sd = stddev(returns);
  if (sd === 0) return null;
  return ((m - riskFree / 252) / sd) * Math.sqrt(252);
}
function sortino(returns: number[], riskFree = 0): number | null {
  if (returns.length < 2) return null;
  const m = mean(returns);
  const downside = returns.filter(r => r < 0);
  if (downside.length === 0) return null;
  const ds = Math.sqrt(downside.reduce((a, r) => a + r * r, 0) / downside.length);
  if (ds === 0) return null;
  return ((m - riskFree / 252) / ds) * Math.sqrt(252);
}
function maxDrawdown(values: number[]): number {
  let peak = -Infinity, maxDD = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? (v - peak) / peak : 0;
    if (dd < maxDD) maxDD = dd;
  }
  return maxDD * 100;
}
function correlation(xArr: number[], yArr: number[]): number | null {
  const n = Math.min(xArr.length, yArr.length);
  if (n < 3) return null;
  const xs = xArr.slice(-n), ys = yArr.slice(-n);
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? null : num / denom;
}
const num = (v: number | string | undefined): number => (typeof v === 'number' ? v : 0);

const TABS = [
  { key: 'overview',    label: 'Overview' },
  { key: 'drawdown',    label: 'Drawdown' },
  { key: 'correlation', label: 'Correlation' },
  { key: 'stress',      label: 'Stress' },
  { key: 'yoc',         label: 'Yield' },
];

const SCENARIOS = [
  { label: 'Mild correction', pct: -10, desc: 'Minor market correction' },
  { label: '2020 COVID crash', pct: -34, desc: 'Feb-Mar 2020 S&P 500 drop' },
  { label: 'Bear market',      pct: -50, desc: 'Typical bear market peak-to-trough' },
  { label: '2008 GFC',         pct: -57, desc: '2008 Global Financial Crisis' },
  { label: 'Thai 1997 crisis', pct: -75, desc: '1997 Tom Yum Goong crisis (SET)' },
  { label: 'Crypto winter',    pct: -80, desc: '2022-style crypto winter' },
];

export default function RiskScreen() {
  const Store = useStore();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const settings = Store.settings();
  const sym = ccySymbol(settings.displayCcy);
  const snapshots = Store.getSnapshots();
  const [tab, setTab] = React.useState('overview');
  const [customPct, setCustomPct] = React.useState('-30');

  const sorted = [...(snapshots || [])].sort((a, b) => a.date.localeCompare(b.date));
  const portValues = sorted.map(s => num(s.value));
  const portReturns = computeReturns(portValues);

  const sharpeRatio = sharpe(portReturns);
  const sortinoRatio = sortino(portReturns);
  const annualReturn = portReturns.length >= 2
    ? (Math.pow(portValues[portValues.length - 1] / portValues[0], 252 / portReturns.length) - 1) * 100
    : null;
  const volAnnual = stddev(portReturns) * Math.sqrt(252) * 100;
  const maxDD = maxDrawdown(portValues);
  const calmarRatio = maxDD !== 0 && annualReturn !== null ? annualReturn / Math.abs(maxDD) : null;

  let peakVal = -Infinity;
  const ddSeries = sorted.map(s => {
    const v = num(s.value);
    if (v > peakVal) peakVal = v;
    return { date: s.date, dd: peakVal > 0 ? ((v - peakVal) / peakVal) * 100 : 0 };
  });

  // Correlation
  const classes = ASSET_CLASSES.filter(cls => sorted.some(s => num(s[cls.key]) > 0));
  const classReturns: Record<string, number[]> = {};
  for (const cls of classes) classReturns[cls.key] = computeReturns(sorted.map(s => num(s[cls.key])));

  // Unique class pairs for correlation
  const pairs: { a: typeof classes[0]; b: typeof classes[0]; r: number | null }[] = [];
  for (let i = 0; i < classes.length; i++) {
    for (let j = i + 1; j < classes.length; j++) {
      pairs.push({ a: classes[i], b: classes[j], r: correlation(classReturns[classes[i].key], classReturns[classes[j].key]) });
    }
  }
  pairs.sort((x, y) => (y.r ?? -2) - (x.r ?? -2));

  const currentValue = Store.grandTotals().value;

  // Yield on cost
  const yocRows: { clsKey: string; short: string; name: string; cost: number; value: number; totalDivIncome: number; yoc: number; curYield: number }[] = [];
  for (const cls of ASSET_CLASSES) {
    for (const p of Store.positions(cls.key)) {
      const divs = Store.getDividends().filter(d => d.classKey === cls.key && d.name === p.name);
      const totalDivIncome = divs.reduce((a, d) => {
        const raw = d.totalAmount || (d.amountPerShare ? d.amountPerShare * p.qty : 0);
        return a + Store.toDisplay(cls.ccy === 'USD' ? raw * (Store.get().fx.USDTHB || 34.5) : raw, 'THB');
      }, 0);
      const costDisp = Store.toDisplay(p.cost, cls.ccy);
      const valDisp = Store.toDisplay(p.value, cls.ccy);
      const yoc = costDisp > 0 ? (totalDivIncome / costDisp) * 100 : 0;
      const curYield = valDisp > 0 ? (totalDivIncome / valDisp) * 100 : 0;
      if (divs.length > 0 || p.value > 0) {
        yocRows.push({ clsKey: cls.key, short: cls.short, name: p.name, cost: costDisp, value: valDisp, totalDivIncome, yoc, curYield });
      }
    }
  }
  yocRows.sort((a, b) => b.yoc - a.yoc);
  const yocWithDiv = yocRows.filter(r => r.totalDivIncome > 0);

  const hasData = sorted.length >= 7;
  const s = makeStyles(theme);

  function ratioColor(v: number | null, good: number, bad: number): string {
    if (v === null) return theme.fg3;
    if (v >= good) return theme.success;
    if (v <= bad) return theme.danger;
    return theme.warning;
  }

  const fmt2 = (v: number) => v.toFixed(2);
  const fmt1p = (v: number) => v.toFixed(1) + '%';

  const overviewMetrics = [
    { label: 'Sharpe Ratio',  value: sharpeRatio,  fmt: fmt2,  color: ratioColor(sharpeRatio, 1, 0),  sub: '>1 good · >2 very good' },
    { label: 'Sortino Ratio', value: sortinoRatio, fmt: fmt2,  color: ratioColor(sortinoRatio, 2, 0), sub: 'Penalizes downside only' },
    { label: 'Max Drawdown',  value: maxDD,        fmt: fmt1p, color: maxDD > -10 ? theme.success : maxDD > -25 ? theme.warning : theme.danger, sub: 'Largest peak-to-trough loss' },
    { label: 'Calmar Ratio',  value: calmarRatio,  fmt: fmt2,  color: ratioColor(calmarRatio, 1, 0),  sub: 'Return / Max drawdown' },
    { label: 'Annual Return', value: annualReturn, fmt: fmt1p, color: annualReturn !== null ? (annualReturn >= 0 ? theme.success : theme.danger) : theme.fg3, sub: 'Annualized return' },
    { label: 'Annual Vol',    value: volAnnual,    fmt: fmt1p, color: volAnnual < 10 ? theme.success : volAnnual < 25 ? theme.warning : theme.danger, sub: 'Annualized daily volatility' },
  ];

  const curDD = ddSeries.length ? ddSeries[ddSeries.length - 1].dd : 0;
  const ddPoints = ddSeries.map(d => ({ date: d.date, value: d.dd }));
  const customNum = parseFloat(customPct);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.subtitle}>Risk metrics, drawdown, correlation, stress tests & yield on cost</Text>

        {/* Tabs */}
        <View style={s.segRow}>
          {TABS.map(t => {
            const on = tab === t.key;
            return (
              <Pressable key={t.key} onPress={() => setTab(t.key)} style={[s.seg, { backgroundColor: on ? theme.accent : theme.bgSunken }]}>
                <Text style={[s.segTxt, { color: on ? theme.fgOnCopper : theme.fg3 }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {!hasData && tab !== 'stress' && tab !== 'yoc' && (
          <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📊</Text>
            <Text style={[s.emptyTitle, { color: theme.fg1 }]}>Not enough history</Text>
            <Text style={[s.note, { textAlign: 'center' }]}>Risk metrics need at least 7 daily snapshots. Come back after a few more days.</Text>
          </Card>
        )}

        {/* OVERVIEW */}
        {tab === 'overview' && hasData && (
          <>
            <View style={s.kpiGrid}>
              {overviewMetrics.map(m => (
                <KpiBox
                  key={m.label}
                  label={m.label}
                  value={m.value !== null ? m.fmt(m.value) : '—'}
                  accent={m.value !== null ? m.color : theme.fg3}
                  sub={m.sub}
                  style={s.kpiCell}
                />
              ))}
            </View>
            <Card>
              <Text style={s.sectionTitle}>Metric Guide</Text>
              {[
                ['Sharpe Ratio', 'Return per unit of total risk. >1 good, >2 excellent.'],
                ['Sortino Ratio', 'Like Sharpe but only downside risk counts.'],
                ['Max Drawdown', 'Biggest loss from a peak. Smaller is better.'],
                ['Calmar Ratio', 'Annual return / Max Drawdown. >1 is a good trade-off.'],
                ['Annual Volatility', 'Std dev of daily returns × √252. Lower = smoother.'],
              ].map(([k, v], i) => (
                <View key={k} style={{ marginTop: i === 0 ? 8 : 6 }}>
                  <Text style={s.guideTxt}>
                    <Text style={{ color: theme.fg1, fontWeight: '700' }}>{k}: </Text>
                    {v}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* DRAWDOWN */}
        {tab === 'drawdown' && hasData && (
          <>
            <View style={s.kpiRow}>
              <KpiBox label="Max Drawdown" value={maxDD.toFixed(1) + '%'} accent={theme.danger} sub="Peak to trough" style={s.kpi} />
              <KpiBox
                label="Current Drawdown"
                value={curDD.toFixed(1) + '%'}
                accent={curDD < -1 ? theme.danger : theme.success}
                sub={curDD >= -0.1 ? 'At all-time high' : 'Below ATH'}
                style={s.kpi}
              />
            </View>
            <Card style={{ gap: 8 }}>
              <Text style={s.sectionTitle}>Drawdown Chart</Text>
              <Text style={s.subSmall}>% below running peak · 0% = all-time high</Text>
              {ddPoints.length > 1 ? (
                <LineChart points={ddPoints} width={width - 64} height={140} color={theme.danger} />
              ) : (
                <Text style={s.note}>Not enough data.</Text>
              )}
              <View style={s.dateRow}>
                <Text style={s.metaTxt}>{sorted[0]?.date}</Text>
                <Text style={s.metaTxt}>{sorted[sorted.length - 1]?.date}</Text>
              </View>
            </Card>
          </>
        )}

        {/* CORRELATION */}
        {tab === 'correlation' && hasData && (
          <Card>
            <Text style={s.sectionTitle}>Asset Class Correlation</Text>
            <Text style={s.subSmall}>Daily-return correlation between class pairs · closer to 0 = more diversified</Text>
            {classes.length < 2 ? (
              <Text style={s.note}>Need at least 2 asset classes with history.</Text>
            ) : (
              <>
                {pairs.map((p, i) => {
                  const v = p.r;
                  const barPct = v !== null ? Math.min(100, Math.abs(v) * 100) : 0;
                  const barColor = v === null ? theme.fg4
                    : v >= 0.7 ? theme.danger
                    : v >= 0.3 ? theme.warning
                    : v >= 0 ? theme.fg4
                    : theme.success;
                  return (
                    <View key={p.a.key + p.b.key}>
                      {i > 0 && <Separator />}
                      <View style={s.corrRow}>
                        <View style={s.corrHead}>
                          <View style={[s.dot, { backgroundColor: CLASS_COLORS[p.a.key] }]} />
                          <View style={[s.dot, { backgroundColor: CLASS_COLORS[p.b.key] }]} />
                          <Text style={[s.corrLabel, { color: theme.fg1 }]}>{p.a.short} ↔ {p.b.short}</Text>
                          <Text style={[s.corrVal, { color: barColor }]}>{v === null ? '—' : v.toFixed(2)}</Text>
                        </View>
                        <View style={s.barTrack}>
                          <View style={[s.barFill, { width: `${barPct}%`, backgroundColor: barColor }]} />
                        </View>
                      </View>
                    </View>
                  );
                })}
                <Text style={[s.note, { marginTop: 10 }]}>🟢 Green = negative correlation (diversification) · 🔴 Red = high positive (concentrated risk)</Text>
              </>
            )}
          </Card>
        )}

        {/* STRESS */}
        {tab === 'stress' && (
          <>
            <KpiBox label="Current Portfolio" value={sym + fmtBig(currentValue)} accent={theme.accent} sub="Before stress" />
            <Card>
              <Text style={s.sectionTitle}>Stress Scenarios</Text>
              <Text style={s.subSmall}>Simulated impact on current portfolio value</Text>
              {SCENARIOS.map((sc, i) => {
                const after = currentValue * (1 + sc.pct / 100);
                const loss = after - currentValue;
                const pctAbs = Math.abs(sc.pct);
                const barColor = pctAbs < 20 ? theme.warning : pctAbs < 50 ? theme.danger : '#7f1d1d';
                return (
                  <View key={sc.label}>
                    {i > 0 && <Separator />}
                    <View style={s.scRow}>
                      <View style={s.scHead}>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.scLabel, { color: theme.fg1 }]}>{sc.label}</Text>
                          <Text style={s.scDesc}>{sc.desc}</Text>
                        </View>
                        <Text style={[s.scPct, { color: theme.danger }]}>{sc.pct}%</Text>
                      </View>
                      <View style={s.barTrack}>
                        <View style={[s.barFill, { width: `${Math.min(100, pctAbs * 1.25)}%`, backgroundColor: barColor }]} />
                      </View>
                      <View style={s.compMeta}>
                        <Text style={s.metaTxt}>After {sym}{fmtBig(Math.max(0, after))}</Text>
                        <Text style={[s.metaTxt, { color: theme.danger }]}>−{sym}{fmtBig(Math.abs(loss))}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </Card>
            <Card>
              <Text style={s.sectionTitle}>Custom Scenario</Text>
              <View style={s.customRow}>
                <Text style={[s.compLabel, { color: theme.fg2, flex: 0 }]}>Market change</Text>
                <TextInput
                  value={customPct}
                  onChangeText={setCustomPct}
                  keyboardType="numbers-and-punctuation"
                  style={[s.input, { color: theme.fg1, borderColor: theme.border2, backgroundColor: theme.bgSunken }]}
                />
                <Text style={{ color: theme.fg2, fontSize: 14 }}>%</Text>
              </View>
              {!isNaN(customNum) && (() => {
                const after = currentValue * (1 + customNum / 100);
                const diff = after - currentValue;
                return (
                  <Text style={[s.customResult, { color: diff >= 0 ? theme.success : theme.danger }]}>
                    Portfolio: {sym}{fmtBig(Math.max(0, after))}
                    <Text style={{ color: theme.fg3, fontSize: 12, fontWeight: '400' }}>  ({diff >= 0 ? '+' : ''}{sym}{fmtBig(diff)})</Text>
                  </Text>
                );
              })()}
            </Card>
          </>
        )}

        {/* YIELD ON COST */}
        {tab === 'yoc' && (
          yocWithDiv.length === 0 ? (
            <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📊</Text>
              <Text style={[s.emptyTitle, { color: theme.fg1 }]}>No dividend data</Text>
              <Text style={[s.note, { textAlign: 'center' }]}>Add dividend entries in the Dividend Calendar to see yield on cost.</Text>
            </Card>
          ) : (
            <Card>
              <Text style={s.sectionTitle}>Yield on Cost</Text>
              <Text style={s.subSmall}>Dividend income ÷ cost basis · return on original investment</Text>
              {yocRows.map((r, i) => (
                <View key={r.clsKey + ':' + r.name}>
                  {i > 0 && <Separator />}
                  <View style={s.yocRow}>
                    <View style={[s.avatar, { backgroundColor: CLASS_COLORS[r.clsKey] }]}>
                      <Text style={s.avatarTxt}>{r.short.slice(0, 2)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.compLabel, { color: theme.fg1, fontWeight: '600' }]}>{r.name.replace(/THB$/, '')}</Text>
                      <Text style={s.metaTxt}>
                        Cost {sym}{fmtBig(r.cost)} · Div {r.totalDivIncome > 0 ? sym + fmtBig(r.totalDivIncome) : '—'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.yocVal, { color: r.yoc > 5 ? theme.success : r.yoc > 2 ? theme.warning : theme.fg2 }]}>
                        {r.yoc > 0 ? r.yoc.toFixed(2) + '%' : '—'}
                      </Text>
                      <Text style={s.metaTxt}>cur {r.curYield > 0 ? r.curYield.toFixed(2) + '%' : '—'}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          )
        )}
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
    sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.fg2 },
    subSmall: { fontSize: 11, color: theme.fg3, marginTop: 2, marginBottom: 8 },
    note:     { fontSize: 12, color: theme.fg3, paddingVertical: 4 },
    emptyTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
    kpiGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    kpiCell:  { width: '47.5%' },
    kpiRow:   { flexDirection: 'row', gap: 10 },
    kpi:      { flex: 1 },
    guideTxt: { fontSize: 12, color: theme.fg3, lineHeight: 17 },
    dot:      { width: 9, height: 9, borderRadius: 5 },
    barTrack: { height: 8, borderRadius: 4, backgroundColor: theme.bgSunken, overflow: 'hidden' },
    barFill:  { height: '100%', borderRadius: 4 },
    compMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    metaTxt:  { fontSize: 11, color: theme.fg3 },
    compLabel:{ flex: 1, fontSize: 14 },
    dateRow:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
    // correlation
    corrRow:  { paddingVertical: 10, gap: 6 },
    corrHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    corrLabel:{ flex: 1, fontSize: 13, fontWeight: '500', marginLeft: 2 },
    corrVal:  { fontSize: 14, fontWeight: '700' },
    // stress
    scRow:    { paddingVertical: 10, gap: 6 },
    scHead:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    scLabel:  { fontSize: 14, fontWeight: '600' },
    scDesc:   { fontSize: 11, color: theme.fg3, marginTop: 1 },
    scPct:    { fontSize: 14, fontWeight: '700' },
    customRow:{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
    input:    { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, width: 90, textAlign: 'right', fontSize: 14 },
    customResult: { fontSize: 14, fontWeight: '700', marginTop: 12 },
    // yoc
    yocRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
    avatar:   { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    avatarTxt:{ color: '#fff', fontSize: 11, fontWeight: '700' },
    yocVal:   { fontSize: 15, fontWeight: '700' },
  });
}
