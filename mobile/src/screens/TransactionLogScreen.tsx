import React, { useState } from 'react';
import {
  FlatList, View, Text, Pressable, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Separator from '../components/primitives/Separator';
import { fmtCcy, fmtDate } from '../core/fmt';
import type { WalletTransaction } from '../core/store';

const EMPTY: Partial<WalletTransaction> = { flow: 'expense', date: new Date().toISOString().slice(0, 10), amount: 0 };

export default function TransactionLogScreen() {
  const Store  = useStore();
  const { theme } = useTheme();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<WalletTransaction>>(EMPTY);

  const wallet = Store.getWallet();
  const txns   = [...wallet.transactions].sort((a, b) => b.date.localeCompare(a.date));

  function save() {
    if (!form.accountId) { Alert.alert('Select an account'); return; }
    if (!form.amount || Number(form.amount) <= 0) { Alert.alert('Enter an amount'); return; }
    Store.addTransaction({
      accountId:   form.accountId!,
      date:        form.date || new Date().toISOString().slice(0, 10),
      amount:      Number(form.amount),
      flow:        form.flow || 'expense',
      categoryId:  form.categoryId || null,
      note:        form.note || '',
      toAccountId: null, fxRate: null,
    });
    setShowAdd(false);
    setForm(EMPTY);
  }

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <View style={s.headerBar}>
        <Text style={[s.count, { color: theme.fg3 }]}>{txns.length} transactions</Text>
        <Pressable onPress={() => setShowAdd(true)} style={[s.addBtn, { backgroundColor: theme.accent }]}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>+ Add</Text>
        </Pressable>
      </View>

      <FlatList
        data={txns}
        keyExtractor={t => t.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        ItemSeparatorComponent={() => <Separator mx={16} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Text style={{ color: theme.fg3 }}>No transactions yet.</Text>
          </View>
        }
        renderItem={({ item: t }) => {
          const acc = wallet.accounts.find(a => a.id === t.accountId);
          const cat = wallet.categories.find(c => c.id === t.categoryId);
          const isIncome = t.flow === 'income';
          return (
            <Pressable
              style={s.txRow}
              onLongPress={() => Alert.alert('Delete', 'Remove this transaction?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => Store.deleteTransaction(t.id) },
              ])}
            >
              <View style={[s.flowDot, { backgroundColor: isIncome ? theme.success : t.flow === 'transfer' ? theme.info : theme.danger }]} />
              <View style={s.txInfo}>
                <Text style={[s.txNote, { color: theme.fg1 }]}>{t.note || cat?.name || (t.flow === 'transfer' ? 'Transfer' : t.flow)}</Text>
                <Text style={[s.txMeta, { color: theme.fg3 }]}>
                  {fmtDate(t.date)} · {acc?.name || '—'}
                </Text>
              </View>
              <Text style={[s.txAmt, { color: isIncome ? theme.success : t.flow === 'transfer' ? theme.fg2 : theme.danger }]}>
                {isIncome ? '+' : t.flow === 'transfer' ? '' : '−'}{fmtCcy(t.amount, acc?.currency || 'THB')}
              </Text>
            </Pressable>
          );
        }}
      />

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.bgApp }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.modalHeader}>
              <Pressable onPress={() => setShowAdd(false)}><Text style={{ color: theme.accent }}>Cancel</Text></Pressable>
              <Text style={[s.modalTitle, { color: theme.fg1 }]}>New Transaction</Text>
              <Pressable onPress={save}><Text style={{ color: theme.accent, fontWeight: '600' }}>Save</Text></Pressable>
            </View>
            <ScrollView style={{ padding: 16 }}>
              {/* Flow type */}
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Type</Text>
              <View style={s.segRow}>
                {(['expense', 'income', 'transfer'] as const).map(f => (
                  <Pressable key={f} onPress={() => setForm(p => ({ ...p, flow: f }))}
                    style={[s.seg, form.flow === f && { backgroundColor: theme.accent }]}>
                    <Text style={{ color: form.flow === f ? '#fff' : theme.fg2, textTransform: 'capitalize' }}>{f}</Text>
                  </Pressable>
                ))}
              </View>
              {/* Account */}
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Account</Text>
              <View style={s.segRow}>
                {wallet.accounts.map(a => (
                  <Pressable key={a.id} onPress={() => setForm(p => ({ ...p, accountId: a.id }))}
                    style={[s.seg, form.accountId === a.id && { backgroundColor: theme.accent }]}>
                    <Text style={{ color: form.accountId === a.id ? '#fff' : theme.fg2, fontSize: 13 }}>{a.name}</Text>
                  </Pressable>
                ))}
              </View>
              {/* Amount */}
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Amount</Text>
              <TextInput
                value={String(form.amount || '')}
                onChangeText={v => setForm(p => ({ ...p, amount: parseFloat(v) || 0 }))}
                placeholder="0.00" placeholderTextColor={theme.fg4}
                keyboardType="decimal-pad"
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
              />
              {/* Date */}
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Date</Text>
              <TextInput
                value={form.date}
                onChangeText={v => setForm(p => ({ ...p, date: v }))}
                placeholder="YYYY-MM-DD" placeholderTextColor={theme.fg4}
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
              />
              {/* Note */}
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Note</Text>
              <TextInput
                value={form.note || ''}
                onChangeText={v => setForm(p => ({ ...p, note: v }))}
                placeholder="Optional note" placeholderTextColor={theme.fg4}
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
    safe:    { flex: 1, backgroundColor: theme.bgApp },
    headerBar:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border1, backgroundColor: theme.bgSurface },
    count:   { fontSize: 13 },
    addBtn:  { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
    txRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
    flowDot: { width: 8, height: 8, borderRadius: 4 },
    txInfo:  { flex: 1 },
    txNote:  { fontSize: 14, fontWeight: '500' },
    txMeta:  { fontSize: 12, marginTop: 1 },
    txAmt:   { fontSize: 15, fontWeight: '600' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border1 },
    modalTitle:  { fontSize: 17, fontWeight: '600' },
    inputLabel:  { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
    input:  { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
    segRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    seg:    { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: theme.bgSunken, borderWidth: 1, borderColor: theme.border1 },
  });
}
