import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Card from '../components/primitives/Card';
import KpiBox from '../components/primitives/KpiBox';
import Separator from '../components/primitives/Separator';
import { ccySymbol, fmtBig } from '../core/fmt';
import { ASSET_CLASSES, CLASS_COLORS } from '../core/constants';

export default function RebalancingScreen() {
  const Store = useStore();
  const { theme } = useTheme();
  const settings = Store.settings();
  const sym = ccySymbol(settings.displayCcy);
  const totals = Store.grandTotals();
  const totalValue = totals.value || 0;

  const targetAlloc = Store.getTargetAllocation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    const init: Record<string, string> = {};
    for (const cls of ASSET_CLASSES) {
      init[cls.key] = targetAlloc[cls.key] != null ? String(targetAlloc[cls.key]) : '0';
    }
    setDraft(init);
  }, [editing]);

  const rows = ASSET_CLASSES.map(cls => {
    const ct = Store.classTotals(cls.key);
    const curValue = ct ? ct.value : 0;
    const curPct = totalValue > 0 ? (curValue / totalValue) * 100 : 0;
    const tgtPct = targetAlloc[cls.key] || 0;
    const drift = curPct - tgtPct;
    const tgtValue = totalValue * (tgtPct / 100);
    const delta = tgtValue - curValue; // positive = buy, negative = sell
    return { cls, curValue, curPct, tgtPct, drift, delta, tgtValue, color: CLASS_COLORS[cls.key] };
  });

  const totalTarget = rows.reduce((a, r) => a + r.tgtPct, 0);
  const unallocated = 100 - totalTarget;
  const hasTgt = rows.some(r => r.tgtPct > 0);
  const draftTotal = Object.values(draft).reduce((a, v) => a + (parseFloat(v) || 0), 0);
  const saveDisabled = Math.abs(draftTotal - 100) > 0.01 && draftTotal !== 0;

  function saveTargets() {
    for (const cls of ASSET_CLASSES) {
      Store.setTargetAllocation(cls.key, parseFloat(draft[cls.key]) || 0);
    }
    setEditing(false);
  }

  const s = makeStyles(theme);
  const visibleRows = rows.filter(r => r.curValue > 0 || r.tgtPct > 0);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        {/* Header + edit toggle */}
        <View style={s.headerBar}>
          <Text style={[s.sub, { color: theme.fg3, flex: 1 }]}>
            Set target % per class · see drift · buy/sell amounts
          </Text>
          {editing ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => setEditing(false)} style={[s.btn, { backgroundColor: theme.bgSunken, borderColor: theme.border1, borderWidth: 1 }]}>
                <Text style={{ color: theme.fg2, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveTargets} disabled={saveDisabled}
                style={[s.btn, { backgroundColor: saveDisabled ? theme.fgDisabled : theme.accent }]}>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Save</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setEditing(true)} style={[s.btn, { backgroundColor: theme.accent }]}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Edit targets</Text>
            </Pressable>
          )}
        </View>

        {/* Edit targets */}
        {editing && (
          <Card>
            <Text style={[s.cardTitle, { color: theme.fg1 }]}>Set target allocations</Text>
            <Text style={{ fontSize: 12, color: theme.fg3, marginTop: 2, marginBottom: 12 }}>
              Must sum to 100% · currently {draftTotal.toFixed(1)}%
              {Math.abs(draftTotal - 100) > 0.01 && draftTotal > 0 &&
                <Text style={{ color: theme.danger }}>  ⚠ {(100 - draftTotal).toFixed(1)}% remaining</Text>}
            </Text>
            {ASSET_CLASSES.map(cls => (
              <View key={cls.key} style={s.editRow}>
                <View style={[s.dot, { backgroundColor: CLASS_COLORS[cls.key] }]} />
                <Text style={{ flex: 1, fontSize: 13, color: theme.fg2 }}>{cls.label}</Text>
                <TextInput
                  value={draft[cls.key] ?? ''}
                  onChangeText={v => setDraft(d => ({ ...d, [cls.key]: v }))}
                  keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.fg4}
                  style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
                />
                <Text style={{ fontSize: 12, color: theme.fg3, width: 14 }}>%</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Empty state */}
        {!hasTgt && !editing && (
          <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>⚖️</Text>
            <Text style={{ fontWeight: '600', fontSize: 15, color: theme.fg1, marginBottom: 6 }}>No targets set yet</Text>
            <Text style={{ color: theme.fg3, fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
              Set target % per asset class to see drift and rebalancing suggestions.
            </Text>
            <Pressable onPress={() => setEditing(true)} style={[s.btn, { backgroundColor: theme.accent }]}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Set targets</Text>
            </Pressable>
          </Card>
        )}

        {hasTgt && (
          <>
            {/* KPI row */}
            <View style={s.kpiRow}>
              <KpiBox label="Portfolio Value" value={sym + fmtBig(totalValue)} accent={theme.accent}
                sub={`${totals.classes.length} asset classes`} style={s.kpi} />
              <KpiBox label="Target Allocated" value={totalTarget.toFixed(1) + '%'}
                sub={Math.abs(unallocated) > 0.1
                  ? (unallocated > 0 ? `${unallocated.toFixed(1)}% unallocated` : `${Math.abs(unallocated).toFixed(1)}% over`)
                  : undefined}
                subColor={unallocated < 0 ? theme.danger : theme.fg3}
                style={s.kpi} />
            </View>
            <View style={s.kpiRow}>
              <KpiBox label="Overweight" value={String(rows.filter(r => r.tgtPct > 0 && r.drift > 2).length)}
                accent={theme.danger} sub="drift > 2%" style={s.kpi} />
              <KpiBox label="Underweight" value={String(rows.filter(r => r.tgtPct > 0 && r.drift < -2).length)}
                accent={theme.success} sub="drift < -2%" style={s.kpi} />
            </View>

            {/* Current vs Target stacked bars */}
            <Card>
              <Text style={[s.cardTitle, { color: theme.fg1, marginBottom: 12 }]}>Current vs Target Allocation</Text>
              <Text style={[s.barLabel, { color: theme.fg3 }]}>CURRENT</Text>
              <View style={[s.stackBar, { backgroundColor: theme.bgSunken }]}>
                {rows.filter(r => r.curValue > 0).map(r => (
                  <View key={r.cls.key} style={{ width: `${r.curPct}%`, backgroundColor: r.color }} />
                ))}
              </View>
              <Text style={[s.barLabel, { color: theme.fg3, marginTop: 12 }]}>TARGET</Text>
              <View style={[s.stackBar, { backgroundColor: theme.bgSunken }]}>
                {rows.filter(r => r.tgtPct > 0).map(r => (
                  <View key={r.cls.key} style={{ width: `${r.tgtPct}%`, backgroundColor: r.color, opacity: 0.7 }} />
                ))}
              </View>
              <View style={s.legendWrap}>
                {visibleRows.map(r => (
                  <View key={r.cls.key} style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: r.color }]} />
                    <Text style={{ fontSize: 11, color: theme.fg2 }}>{r.cls.short}</Text>
                  </View>
                ))}
              </View>
            </Card>

            {/* Rebalancing actions */}
            <Card noPad>
              <View style={{ padding: 16, paddingBottom: 8 }}>
                <Text style={[s.cardTitle, { color: theme.fg1 }]}>Rebalancing Actions</Text>
                <Text style={{ fontSize: 12, color: theme.fg3, marginTop: 2 }}>
                  Buy/sell amounts to reach target · in {settings.displayCcy}
                </Text>
              </View>
              {visibleRows.map((r, idx) => {
                const driftAbs = Math.abs(r.drift);
                const driftColor = driftAbs < 1 ? theme.fg3 : driftAbs < 3 ? theme.fg2 : r.drift > 0 ? theme.danger : theme.success;
                const action = r.tgtPct > 0 && Math.abs(r.delta) > 1
                  ? { txt: (r.delta > 0 ? '▲ Buy ' : '▼ Sell ') + sym + fmtBig(Math.abs(r.delta)), color: r.delta > 0 ? theme.success : theme.danger }
                  : r.tgtPct > 0 ? { txt: 'On target ✓', color: theme.fg3 } : { txt: '—', color: theme.fg4 };
                return (
                  <View key={r.cls.key}>
                    {idx > 0 && <Separator mx={16} />}
                    <View style={s.actionRow}>
                      <View style={[s.classBadge, { backgroundColor: r.color }]}>
                        <Text style={s.classBadgeTxt}>{r.cls.short}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.actName, { color: theme.fg1 }]}>{r.cls.label}</Text>
                        <Text style={[s.actMeta, { color: theme.fg3 }]}>
                          {sym}{fmtBig(r.curValue)} · {r.curPct.toFixed(1)}% now
                          {r.tgtPct > 0 ? ` → ${r.tgtPct.toFixed(1)}% target (${sym}${fmtBig(r.tgtValue)})` : ''}
                        </Text>
                        {/* drift bar */}
                        <View style={[s.driftBar, { backgroundColor: theme.bgSunken }]}>
                          <View style={{ width: `${Math.min(100, driftAbs * 5)}%`, height: '100%', backgroundColor: driftColor, borderRadius: 2 }} />
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text style={[s.driftTxt, { color: driftColor, fontWeight: driftAbs >= 3 ? '700' : '400' }]}>
                          {r.tgtPct > 0 ? (r.drift > 0 ? '+' : '') + r.drift.toFixed(1) + '%' : '—'}
                        </Text>
                        <Text style={[s.actionTxt, { color: action.color }]}>{action.txt}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
              {/* total footer */}
              <View style={[s.totalRow, { backgroundColor: theme.bgSunken }]}>
                <Text style={{ fontWeight: '700', fontSize: 13, color: theme.fg1, flex: 1 }}>Total</Text>
                <Text style={{ fontWeight: '700', fontSize: 13, color: theme.fg1 }}>{sym}{fmtBig(totalValue)} · </Text>
                <Text style={{ fontWeight: '700', fontSize: 13, color: Math.abs(totalTarget - 100) < 0.1 ? theme.success : theme.danger }}>
                  {totalTarget.toFixed(1)}%
                </Text>
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bgApp },
    sub:  { fontSize: 13 },
    headerBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    btn:  { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
    cardTitle: { fontSize: 15, fontWeight: '700' },
    editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    dot:  { width: 10, height: 10, borderRadius: 5 },
    input: { width: 70, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 14, textAlign: 'right' },
    kpiRow: { flexDirection: 'row', gap: 12 },
    kpi:  { flex: 1 },
    barLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
    stackBar: { flexDirection: 'row', height: 20, borderRadius: 4, overflow: 'hidden' },
    legendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 2 },
    actionRow: { flexDirection: 'row', gap: 10, padding: 16, alignItems: 'flex-start' },
    classBadge: { width: 34, height: 22, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
    classBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
    actName: { fontSize: 14, fontWeight: '600' },
    actMeta: { fontSize: 11, marginTop: 2 },
    driftBar: { height: 4, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
    driftTxt: { fontSize: 12 },
    actionTxt: { fontSize: 12, fontWeight: '700' },
    totalRow: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 16 },
  });
}
