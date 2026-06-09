import React, { useMemo, useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TextInput, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Card from '../components/primitives/Card';
import KpiBox from '../components/primitives/KpiBox';
import Separator from '../components/primitives/Separator';
import LineChart from '../components/charts/LineChart';
import { ccySymbol, fmtBig } from '../core/fmt';

interface DcaPoint { year: number; value: number; contributed: number; }

// Month-by-month compounding with a fixed monthly contribution.
function simulateDCA(startValue: number, monthlyContrib: number, annualReturnPct: number, years: number): DcaPoint[] {
  const monthlyRate = annualReturnPct / 100 / 12;
  const points: DcaPoint[] = [{ year: 0, value: startValue, contributed: 0 }];
  let value = startValue;
  let totalContrib = 0;
  for (let m = 1; m <= years * 12; m++) {
    value = value * (1 + monthlyRate) + monthlyContrib;
    totalContrib += monthlyContrib;
    if (m % 12 === 0) points.push({ year: m / 12, value, contributed: totalContrib });
  }
  return points;
}

export default function PlanningScreen() {
  const Store = useStore();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const s = makeStyles(theme);

  const settings = Store.settings();
  const sym = ccySymbol(settings.displayCcy);
  const portValue = Store.grandTotals().value;

  const [initialInvest, setInitialInvest] = useState(String(Math.round(portValue)));
  const [monthly, setMonthly] = useState('10000');
  const [years, setYears] = useState('10');
  const [returnPct, setReturnPct] = useState('8');

  const init = parseFloat(initialInvest) || 0;
  const mo = parseFloat(monthly) || 0;
  const yrs = Math.min(60, Math.max(1, parseFloat(years) || 10));
  const ret = parseFloat(returnPct) || 8;

  const points = useMemo(() => simulateDCA(init, mo, ret, yrs), [init, mo, ret, yrs]);
  const finalVal = points.length ? points[points.length - 1].value : 0;
  const totalInvested = init + mo * yrs * 12;
  const totalGrowth = finalVal - totalInvested;

  // LineChart points: one per year (yearLabel + projected value).
  const chartPoints = points.map(p => ({ date: 'Yr ' + p.year, value: p.value }));

  const fields: { label: string; value: string; set: (v: string) => void }[] = [
    { label: 'Current value', value: initialInvest, set: setInitialInvest },
    { label: 'Monthly contribution', value: monthly, set: setMonthly },
    { label: 'Period (years)', value: years, set: setYears },
    { label: 'Annual return %', value: returnPct, set: setReturnPct },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Inputs */}
        <Card style={{ gap: 4 }}>
          <Text style={s.sectionTitle}>Assumptions</Text>
          <View style={s.fieldGrid}>
            {fields.map(f => (
              <View key={f.label} style={s.field}>
                <Text style={[s.fieldLabel, { color: theme.fg3 }]}>{f.label}</Text>
                <TextInput
                  value={f.value}
                  onChangeText={f.set}
                  keyboardType="decimal-pad"
                  placeholderTextColor={theme.fg4}
                  style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
                />
              </View>
            ))}
          </View>
        </Card>

        {/* KPIs */}
        <View style={s.kpiRow}>
          <KpiBox label={`Final value (${yrs}Y)`} value={sym + fmtBig(finalVal)}
            sub={`×${(finalVal / (init || 1)).toFixed(1)}`} accent={theme.accent} style={s.kpi} />
          <KpiBox label="Total invested" value={sym + fmtBig(totalInvested)}
            sub={`${sym}${fmtBig(init)} + ${sym}${fmtBig(mo)}/mo`} style={s.kpi} />
        </View>
        <KpiBox label="Investment growth" value={sym + fmtBig(totalGrowth)}
          sub={totalInvested > 0 ? '+' + ((totalGrowth / totalInvested) * 100).toFixed(0) + '%' : ''}
          accent={theme.success} subColor={theme.success} />

        {/* Projection chart */}
        <Card style={{ gap: 4 }}>
          <Text style={s.sectionTitle}>Projected growth</Text>
          <Text style={[s.sectionSub, { color: theme.fg3 }]}>
            {sym}{fmtBig(init)} start + {sym}{fmtBig(mo)}/month at {ret}% return
          </Text>
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <LineChart points={chartPoints} width={width - 64} height={160} color={theme.accent} />
          </View>
        </Card>

        {/* Year-by-year breakdown */}
        <Card noPad>
          <Text style={[s.sectionTitle, { padding: 16, paddingBottom: 8 }]}>Year-by-year breakdown</Text>
          <View style={[s.tHead, { borderBottomColor: theme.border1 }]}>
            <Text style={[s.thYear, { color: theme.fg3 }]}>Year</Text>
            <Text style={[s.thNum, { color: theme.fg3 }]}>Value</Text>
            <Text style={[s.thNum, { color: theme.fg3 }]}>Invested</Text>
            <Text style={[s.thNum, { color: theme.fg3 }]}>Growth</Text>
          </View>
          {points.filter(p => p.year > 0).map((p, i) => {
            const invested = init + mo * p.year * 12;
            const growth = p.value - invested;
            return (
              <React.Fragment key={p.year}>
                {i > 0 && <Separator mx={16} />}
                <View style={s.tRow}>
                  <Text style={[s.tdYear, { color: theme.fg1 }]}>Year {p.year}</Text>
                  <Text style={[s.tdNum, { color: theme.fg1, fontWeight: '600' }]}>{sym}{fmtBig(p.value)}</Text>
                  <Text style={[s.tdNum, { color: theme.fg3 }]}>{sym}{fmtBig(invested)}</Text>
                  <Text style={[s.tdNum, { color: theme.success }]}>{sym}{fmtBig(growth)}</Text>
                </View>
              </React.Fragment>
            );
          })}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bgApp },
    scroll: { padding: 16, gap: 12, paddingBottom: 32 },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.fg2 },
    sectionSub: { fontSize: 12 },
    fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
    field: { flexBasis: '47%', flexGrow: 1 },
    fieldLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
    kpiRow: { flexDirection: 'row', gap: 10 },
    kpi: { flex: 1 },
    tHead: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1 },
    thYear: { flex: 1.2, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    thNum: { flex: 1, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' },
    tRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center' },
    tdYear: { flex: 1.2, fontSize: 13, fontWeight: '600' },
    tdNum: { flex: 1, fontSize: 13, textAlign: 'right' },
  });
}
