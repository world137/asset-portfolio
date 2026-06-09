import React, { useState } from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Card from '../components/primitives/Card';
import KpiBox from '../components/primitives/KpiBox';
import { fmtCcy, fmtBig, ccySymbol } from '../core/fmt';
import { WALLET_CURRENCIES } from '../core/constants';
import type { SavingsGoal } from '../core/store';

const GOAL_EMOJIS = ['🎯', '🏖', '🏠', '🚗', '✈️', '💍', '🎓', '🏋️', '📱', '💻', '🐶', '👶'];

interface GoalForm {
  name: string;
  targetAmount: string;
  currency: string;
  targetDate: string;
  linkedAccountId: string;
  note: string;
  emoji: string;
}

const blankForm = (): GoalForm => ({
  name: '', targetAmount: '', currency: 'THB',
  targetDate: '', linkedAccountId: '', note: '', emoji: '🎯',
});

export default function SavingsGoalsScreen() {
  const Store = useStore();
  const { theme } = useTheme();

  const settings = Store.settings();
  const sym      = ccySymbol(settings.displayCcy);
  const wallet   = Store.getWallet();
  const goals    = wallet.savingsGoals || [];

  const [showModal, setShowModal] = useState(false);
  const [editGoal,  setEditGoal]  = useState<SavingsGoal | null>(null);
  const [form,      setForm]      = useState<GoalForm>(blankForm());

  const today = new Date().toISOString().slice(0, 10);

  const accounts = (wallet.accounts || []).filter(a => !a.archived && a.type !== 'credit_card');

  const goalsWithProgress = goals.map(g => {
    const current = g.linkedAccountId
      ? Math.max(0, Store.accountBalance(g.linkedAccountId))
      : null;
    const pct       = current != null ? Math.min((current / g.targetAmount) * 100, 100) : null;
    const isDone    = current != null && current >= g.targetAmount;
    const remaining = current != null ? Math.max(0, g.targetAmount - current) : null;

    // Project completion from last 3 months of net deposits into the linked account
    let projectedDate: string | null = null;
    if (current != null && remaining! > 0 && g.linkedAccountId) {
      const now = new Date();
      let totalNet = 0, months = 0;
      for (let mo = 0; mo < 3; mo++) {
        const d = new Date(now.getFullYear(), now.getMonth() - mo, 1);
        const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        let net = 0;
        for (const t of wallet.transactions) {
          if (!t.date.startsWith(prefix) || t.accountId !== g.linkedAccountId) continue;
          if (t.flow === 'income')  net += t.amount;
          if (t.flow === 'expense') net -= t.amount;
        }
        totalNet += net; months++;
      }
      const avgMonthly = months > 0 ? totalNet / months : 0;
      if (avgMonthly > 0) {
        const monthsNeeded = Math.ceil(remaining! / avgMonthly);
        const projDate = new Date(now.getFullYear(), now.getMonth() + monthsNeeded, 1);
        projectedDate = projDate.toISOString().slice(0, 7);
      }
    }

    return { goal: g, current, pct, isDone, remaining, projectedDate };
  });

  const totalGoals   = goals.length;
  const doneGoals    = goalsWithProgress.filter(g => g.isDone).length;
  const totalTarget  = goalsWithProgress.reduce((s, g) => s + Store.walletToDisplay(g.goal.targetAmount, g.goal.currency), 0);
  const totalCurrent = goalsWithProgress.reduce((s, g) => s + (g.current != null ? Store.walletToDisplay(g.current, g.goal.currency) : 0), 0);

  function openAdd() {
    setEditGoal(null);
    setForm(blankForm());
    setShowModal(true);
  }

  function openEdit(g: SavingsGoal) {
    setEditGoal(g);
    setForm({
      name:            g.name,
      targetAmount:    String(g.targetAmount || ''),
      currency:        g.currency || 'THB',
      targetDate:      g.targetDate || '',
      linkedAccountId: g.linkedAccountId || '',
      note:            g.note || '',
      emoji:           g.emoji || '🎯',
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditGoal(null);
  }

  function save() {
    if (!form.name.trim())                  { Alert.alert('Enter a goal name'); return; }
    if (!(parseFloat(form.targetAmount) > 0)) { Alert.alert('Enter a target amount'); return; }
    const data = {
      name:            form.name.trim(),
      targetAmount:    parseFloat(form.targetAmount),
      currency:        form.currency,
      targetDate:      form.targetDate || null,
      linkedAccountId: form.linkedAccountId || null,
      note:            form.note.trim(),
      emoji:           form.emoji || '🎯',
    };
    if (editGoal) Store.updateSavingsGoal(editGoal.id, data);
    else          Store.addSavingsGoal(data);
    closeModal();
  }

  function confirmDelete() {
    if (!editGoal) return;
    Alert.alert('Delete', 'Remove this savings goal?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { Store.deleteSavingsGoal(editGoal.id); closeModal(); } },
    ]);
  }

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <View style={s.headerBar}>
        <Text style={[s.count, { color: theme.fg3 }]}>{totalGoals} goal{totalGoals !== 1 ? 's' : ''}</Text>
        <Pressable onPress={openAdd} style={[s.addBtn, { backgroundColor: theme.accent }]}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>+ Add</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {goals.length === 0 ? (
          <Card>
            <Text style={{ color: theme.fg3, textAlign: 'center', paddingVertical: 16 }}>
              No savings goals yet. Set a target to track your progress.
            </Text>
          </Card>
        ) : (
          <>
            <View style={s.kpis}>
              <KpiBox label="Total Goals" value={String(totalGoals)} sub={`${doneGoals} completed`} accent={theme.accent} style={{ flex: 1 }} />
              <KpiBox
                label="Overall"
                value={totalTarget > 0 ? `${Math.round((totalCurrent / totalTarget) * 100)}%` : '—'}
                sub={`${sym}${fmtBig(totalCurrent)} of ${sym}${fmtBig(totalTarget)}`}
                style={{ flex: 1 }}
              />
            </View>

            {goalsWithProgress.map(({ goal: g, current, pct, isDone, remaining, projectedDate }) => {
              const linkedAcc = g.linkedAccountId ? (wallet.accounts || []).find(a => a.id === g.linkedAccountId) : null;
              const overdue   = !isDone && !!g.targetDate && g.targetDate < today;
              const barColor  = isDone ? theme.success : (pct != null && pct >= 75) ? theme.warning : theme.accent;
              return (
                <Pressable key={g.id} onPress={() => openEdit(g)}>
                  <Card style={{ borderTopWidth: 3, borderTopColor: isDone ? theme.success : theme.accent }}>
                    <View style={s.goalHead}>
                      <Text style={{ fontSize: 28, lineHeight: 32 }}>{g.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.goalName, { color: theme.fg1 }]}>{g.name}</Text>
                        {!!g.note && <Text style={{ fontSize: 11, color: theme.fg3, marginTop: 2 }}>{g.note}</Text>}
                        {!!linkedAcc && <Text style={{ fontSize: 11, color: theme.fg3, marginTop: 2 }}>Linked: {linkedAcc.name}</Text>}
                      </View>
                      {isDone && (
                        <View style={[s.doneChip, { backgroundColor: theme.success + '22' }]}>
                          <Text style={{ color: theme.success, fontWeight: '700', fontSize: 11 }}>Done!</Text>
                        </View>
                      )}
                    </View>

                    {current != null ? (
                      <>
                        <View style={s.amtRow}>
                          <Text style={{ fontWeight: '700', fontSize: 13, color: isDone ? theme.success : theme.fg1 }}>
                            {fmtCcy(current, g.currency)}
                          </Text>
                          <Text style={{ fontSize: 12, color: theme.fg3 }}>of {fmtCcy(g.targetAmount, g.currency)}</Text>
                        </View>
                        <View style={[s.barTrack, { backgroundColor: theme.bgSunken }]}>
                          <View style={[s.barFill, { width: `${pct ?? 0}%` as const, backgroundColor: barColor }]} />
                        </View>
                        <View style={s.amtRow}>
                          <Text style={{ fontSize: 11, color: theme.fg3 }}>{pct != null ? `${Math.round(pct)}%` : ''}</Text>
                          {remaining! > 0 && (
                            <Text style={{ fontSize: 11, color: theme.fg3 }}>{fmtCcy(remaining!, g.currency)} remaining</Text>
                          )}
                        </View>
                      </>
                    ) : (
                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.fg2 }}>
                        Target: {fmtCcy(g.targetAmount, g.currency)}
                      </Text>
                    )}

                    {(g.targetDate || (projectedDate && !isDone)) && (
                      <View style={[s.amtRow, { marginTop: 8 }]}>
                        {g.targetDate ? (
                          <Text style={{ fontSize: 11, color: overdue ? theme.danger : theme.fg3 }}>
                            {overdue ? '⚠ Overdue: ' : 'Target: '}{g.targetDate}
                          </Text>
                        ) : <Text />}
                        {projectedDate && !isDone && (
                          <Text style={{ fontSize: 11, color: theme.fg3 }}>Projected: {projectedDate}</Text>
                        )}
                      </View>
                    )}
                  </Card>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.bgApp }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.modalHeader}>
              <Pressable onPress={closeModal}><Text style={{ color: theme.accent }}>Cancel</Text></Pressable>
              <Text style={[s.modalTitle, { color: theme.fg1 }]}>{editGoal ? 'Edit Goal' : 'Add Goal'}</Text>
              <Pressable onPress={save}><Text style={{ color: theme.accent, fontWeight: '600' }}>Save</Text></Pressable>
            </View>
            <ScrollView style={{ padding: 16 }}>
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Goal Name</Text>
              <TextInput
                value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))}
                placeholder="e.g. Japan Trip, Emergency Fund" placeholderTextColor={theme.fg4}
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
              />

              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Emoji</Text>
              <View style={s.segRow}>
                {GOAL_EMOJIS.map(e => (
                  <Pressable key={e} onPress={() => setForm(p => ({ ...p, emoji: e }))}
                    style={[s.emojiBtn, form.emoji === e && { borderColor: theme.accent, backgroundColor: theme.accent + '22' }]}>
                    <Text style={{ fontSize: 20 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Target Amount</Text>
              <TextInput
                value={form.targetAmount} onChangeText={v => setForm(p => ({ ...p, targetAmount: v }))}
                placeholder="e.g. 50000" placeholderTextColor={theme.fg4} keyboardType="decimal-pad"
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
              />

              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Currency</Text>
              <View style={s.segRow}>
                {WALLET_CURRENCIES.map(c => (
                  <Pressable key={c} onPress={() => setForm(p => ({ ...p, currency: c }))}
                    style={[s.seg, form.currency === c && { backgroundColor: theme.accent }]}>
                    <Text style={{ color: form.currency === c ? '#fff' : theme.fg2, fontSize: 13 }}>{c}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Target Date (optional)</Text>
              <TextInput
                value={form.targetDate} onChangeText={v => setForm(p => ({ ...p, targetDate: v }))}
                placeholder="YYYY-MM-DD" placeholderTextColor={theme.fg4}
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
              />

              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Linked Account (optional)</Text>
              <View style={s.segRow}>
                <Pressable onPress={() => setForm(p => ({ ...p, linkedAccountId: '' }))}
                  style={[s.seg, form.linkedAccountId === '' && { backgroundColor: theme.accent }]}>
                  <Text style={{ color: form.linkedAccountId === '' ? '#fff' : theme.fg2, fontSize: 13 }}>Not linked</Text>
                </Pressable>
                {accounts.map(a => (
                  <Pressable key={a.id} onPress={() => setForm(p => ({ ...p, linkedAccountId: a.id }))}
                    style={[s.seg, form.linkedAccountId === a.id && { backgroundColor: theme.accent }]}>
                    <Text style={{ color: form.linkedAccountId === a.id ? '#fff' : theme.fg2, fontSize: 13 }}>{a.name} ({a.currency})</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ fontSize: 11, color: theme.fg3, marginTop: 4 }}>Current balance of this account counts as progress.</Text>

              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Note (optional)</Text>
              <TextInput
                value={form.note} onChangeText={v => setForm(p => ({ ...p, note: v }))}
                placeholder="What's this for?" placeholderTextColor={theme.fg4}
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
              />

              {editGoal && (
                <Pressable onPress={confirmDelete} style={s.deleteBtn}>
                  <Text style={{ color: theme.danger, fontWeight: '600' }}>Delete Goal</Text>
                </Pressable>
              )}
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe:    { flex: 1, backgroundColor: theme.bgApp },
    headerBar:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border1, backgroundColor: theme.bgSurface },
    count:   { fontSize: 13 },
    addBtn:  { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
    scroll:  { padding: 16, gap: 14, paddingBottom: 32 },
    kpis:    { flexDirection: 'row', gap: 12 },
    goalHead:{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
    goalName:{ fontSize: 15, fontWeight: '700' },
    doneChip:{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
    amtRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    barTrack:{ height: 8, borderRadius: 4, overflow: 'hidden', marginVertical: 4 },
    barFill: { height: '100%', borderRadius: 4 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border1 },
    modalTitle:  { fontSize: 17, fontWeight: '600' },
    inputLabel:  { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
    input:  { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
    segRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    seg:    { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: theme.bgSunken, borderWidth: 1, borderColor: theme.border1 },
    emojiBtn: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4, borderWidth: 1.5, borderColor: 'transparent' },
    deleteBtn: { marginTop: 28, alignItems: 'center', paddingVertical: 12 },
  });
}
