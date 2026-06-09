import React, { useState } from 'react';
import {
  FlatList, View, Text, Pressable, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Card from '../components/primitives/Card';
import { ccySymbol, fmtBig } from '../core/fmt';
import type { Goal } from '../core/store';

const GOAL_EMOJIS = ['🎯', '🏠', '🚗', '✈️', '🎓', '💍', '🏖️', '💰', '📈', '🏋️', '🌏', '🎁'];

interface GoalForm {
  name: string;
  targetAmount: string;
  targetDate: string;
  note: string;
  emoji: string;
}

const EMPTY: GoalForm = { name: '', targetAmount: '', targetDate: '', note: '', emoji: '🎯' };

// ── Projection helper (simple linear regression on portfolio snapshots) ───────
function projectedDate(snapshots: { date: string; value: number }[], targetAmount: number): string | null {
  if (!snapshots || snapshots.length < 7) return null;
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-90);
  const n = recent.length;
  const x0 = new Date(recent[0].date).getTime();
  let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
  for (const sn of recent) {
    const x = (new Date(sn.date).getTime() - x0) / 86400000;
    const y = sn.value;
    sumX += x; sumY += y; sumXX += x * x; sumXY += x * y;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  if (slope <= 0) return null;
  const intercept = (sumY - slope * sumX) / n;
  const lastX = (new Date(recent[n - 1].date).getTime() - x0) / 86400000;
  const daysNeeded = (targetAmount - intercept) / slope;
  if (daysNeeded <= lastX || daysNeeded > 365 * 50) return null;
  return new Date(x0 + daysNeeded * 86400000).toISOString().slice(0, 10);
}

export default function GoalsScreen() {
  const Store = useStore();
  const { theme } = useTheme();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<GoalForm>(EMPTY);

  const settings = Store.settings();
  const sym = ccySymbol(settings.displayCcy);
  const goals = Store.getGoals();
  const portValue = Store.grandTotals().value;
  const snapshots = Store.getSnapshots();

  const sorted = [...goals].sort((a, b) => (a.targetDate || '9999').localeCompare(b.targetDate || '9999'));

  function openAdd() {
    setEditId(null);
    setForm(EMPTY);
    setShowAdd(true);
  }

  function openEdit(g: Goal) {
    setEditId(g.id);
    setForm({
      name: g.name,
      targetAmount: String(g.targetAmount),
      targetDate: g.targetDate || '',
      note: g.note || '',
      emoji: g.emoji || '🎯',
    });
    setShowAdd(true);
  }

  function save() {
    if (!form.name.trim()) { Alert.alert('Enter a goal name'); return; }
    if (!form.targetAmount || Number(form.targetAmount) <= 0) { Alert.alert('Enter a target amount'); return; }
    const data = {
      name: form.name.trim(),
      targetAmount: Number(form.targetAmount),
      targetDate: form.targetDate || null,
      note: form.note,
      emoji: form.emoji,
    };
    if (editId) Store.updateGoal(editId, data);
    else Store.addGoal(data);
    setShowAdd(false);
    setForm(EMPTY);
    setEditId(null);
  }

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <View style={s.headerBar}>
        <Text style={[s.count, { color: theme.fg3 }]}>{goals.length} goals</Text>
        <Pressable onPress={openAdd} style={[s.addBtn, { backgroundColor: theme.accent }]}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>+ Add</Text>
        </Pressable>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={g => g.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        ListEmptyComponent={
          <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ fontSize: 44, marginBottom: 12 }}>🎯</Text>
            <Text style={{ color: theme.fg1, fontWeight: '600', fontSize: 16, marginBottom: 6 }}>No goals yet</Text>
            <Text style={{ color: theme.fg3, fontSize: 13, textAlign: 'center' }}>
              Add financial goals to track progress toward milestones like a home, travel fund, or early retirement.
            </Text>
          </Card>
        }
        renderItem={({ item: g }) => {
          const tgtDisp = Store.toDisplay(g.targetAmount, 'THB');
          const progress = tgtDisp > 0 ? Math.min(100, (portValue / tgtDisp) * 100) : 0;
          const remaining = Math.max(0, tgtDisp - portValue);
          const projDate = projectedDate(snapshots, g.targetAmount);
          const daysLeft = g.targetDate
            ? Math.ceil((new Date(g.targetDate).getTime() - Date.now()) / 86400000)
            : null;
          const overdue = daysLeft !== null && daysLeft < 0;
          const onTrack = projDate && g.targetDate ? projDate <= g.targetDate : null;
          const progressColor = progress >= 100 ? theme.success
            : progress >= 75 ? theme.accent
            : progress >= 50 ? theme.warning
            : theme.danger;

          return (
            <Pressable
              onPress={() => openEdit(g)}
              onLongPress={() => Alert.alert('Delete', `Remove goal "${g.name}"?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => Store.deleteGoal(g.id) },
              ])}
            >
              <Card>
                <View style={s.row}>
                  <Text style={s.emoji}>{g.emoji || '🎯'}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={s.titleRow}>
                      <Text style={[s.name, { color: theme.fg1 }]}>{g.name}</Text>
                      {progress >= 100 && <Text style={[s.badge, { color: theme.success, backgroundColor: theme.successBg }]}>✓ Reached!</Text>}
                      {overdue && progress < 100 && <Text style={[s.badge, { color: theme.danger, backgroundColor: theme.dangerBg }]}>Overdue</Text>}
                      {!overdue && onTrack === true && <Text style={[s.badge, { color: theme.success, backgroundColor: theme.successBg }]}>On track</Text>}
                      {!overdue && onTrack === false && <Text style={[s.badge, { color: theme.warning, backgroundColor: theme.warningBg }]}>Behind</Text>}
                    </View>
                    {!!g.note && <Text style={[s.note, { color: theme.fg3 }]}>{g.note}</Text>}

                    {/* Progress bar */}
                    <View style={s.progressMeta}>
                      <Text style={[s.progressTxt, { color: theme.fg3 }]}>Progress: {progress.toFixed(1)}%</Text>
                      <Text style={[s.progressTxt, { color: theme.fg3 }]}>Remaining: {sym}{fmtBig(remaining)}</Text>
                    </View>
                    <View style={[s.barTrack, { backgroundColor: theme.bgSunken }]}>
                      <View style={[s.barFill, { width: `${progress}%`, backgroundColor: progressColor }]} />
                    </View>

                    <View style={s.statsRow}>
                      <View>
                        <Text style={[s.statVal, { color: theme.fg1 }]}>{sym}{fmtBig(tgtDisp)}</Text>
                        <Text style={[s.statLbl, { color: theme.fg3 }]}>Target</Text>
                      </View>
                      <View>
                        <Text style={[s.statVal, { color: progressColor }]}>{sym}{fmtBig(portValue)}</Text>
                        <Text style={[s.statLbl, { color: theme.fg3 }]}>Portfolio</Text>
                      </View>
                      {!!g.targetDate && (
                        <View>
                          <Text style={[s.statVal, { color: overdue ? theme.danger : theme.fg1 }]}>{g.targetDate}</Text>
                          <Text style={[s.statLbl, { color: theme.fg3 }]}>
                            {daysLeft !== null ? (daysLeft < 0 ? `${Math.abs(daysLeft)}d ago` : `${daysLeft}d left`) : ''}
                          </Text>
                        </View>
                      )}
                      {projDate && progress < 100 && (
                        <View>
                          <Text style={[s.statVal, { color: theme.fg1 }]}>{projDate}</Text>
                          <Text style={[s.statLbl, { color: theme.fg3 }]}>Projected reach</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        }}
      />

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.bgApp }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.modalHeader}>
              <Pressable onPress={() => setShowAdd(false)}><Text style={{ color: theme.accent }}>Cancel</Text></Pressable>
              <Text style={[s.modalTitle, { color: theme.fg1 }]}>{editId ? 'Edit Goal' : 'New Goal'}</Text>
              <Pressable onPress={save}><Text style={{ color: theme.accent, fontWeight: '600' }}>Save</Text></Pressable>
            </View>
            <ScrollView style={{ padding: 16 }}>
              {/* Emoji picker */}
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Icon</Text>
              <View style={s.segRow}>
                {GOAL_EMOJIS.map(e => (
                  <Pressable key={e} onPress={() => setForm(p => ({ ...p, emoji: e }))}
                    style={[s.emojiBtn, { borderColor: form.emoji === e ? theme.accent : theme.border1, backgroundColor: form.emoji === e ? theme.accentLight : 'transparent' }]}>
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Name */}
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Goal name</Text>
              <TextInput
                value={form.name}
                onChangeText={v => setForm(p => ({ ...p, name: v }))}
                placeholder="e.g. Down payment, Retire at 55…" placeholderTextColor={theme.fg4}
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
              />

              {/* Target amount */}
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Target amount (THB)</Text>
              <TextInput
                value={form.targetAmount}
                onChangeText={v => setForm(p => ({ ...p, targetAmount: v }))}
                placeholder="0" placeholderTextColor={theme.fg4}
                keyboardType="decimal-pad"
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
              />

              {/* Target date */}
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Target date (optional)</Text>
              <TextInput
                value={form.targetDate}
                onChangeText={v => setForm(p => ({ ...p, targetDate: v }))}
                placeholder="YYYY-MM-DD" placeholderTextColor={theme.fg4}
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
              />

              {/* Note */}
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Note</Text>
              <TextInput
                value={form.note}
                onChangeText={v => setForm(p => ({ ...p, note: v }))}
                placeholder="Any extra context…" placeholderTextColor={theme.fg4}
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
              />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe:      { flex: 1, backgroundColor: theme.bgApp },
    headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border1, backgroundColor: theme.bgSurface },
    count:     { fontSize: 13 },
    addBtn:    { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
    row:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    emoji:     { fontSize: 36, lineHeight: 40 },
    titleRow:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
    name:      { fontWeight: '700', fontSize: 15 },
    badge:     { fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
    note:      { fontSize: 12, marginBottom: 6 },
    progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    progressTxt:  { fontSize: 11 },
    barTrack:  { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
    barFill:   { height: '100%', borderRadius: 4 },
    statsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
    statVal:   { fontWeight: '600', fontSize: 14 },
    statLbl:   { fontSize: 12 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border1 },
    modalTitle:  { fontSize: 17, fontWeight: '600' },
    inputLabel:  { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
    input:    { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
    segRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    emojiBtn: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  });
}
