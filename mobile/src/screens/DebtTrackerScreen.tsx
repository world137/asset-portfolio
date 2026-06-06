import React, { useState } from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Card from '../components/primitives/Card';
import Separator from '../components/primitives/Separator';
import { fmtCcy, fmtDate } from '../core/fmt';
import { WALLET_CURRENCIES } from '../core/constants';
import type { Debt } from '../core/store';

const EMPTY: Partial<Debt> = {
  direction: 'borrowed', counterparty: '', amount: 0,
  currency: 'THB', dateStart: new Date().toISOString().slice(0, 10),
};

export default function DebtTrackerScreen() {
  const Store  = useStore();
  const { theme } = useTheme();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<Debt>>(EMPTY);

  const wallet = Store.getWallet();
  const active = wallet.debts.filter(d => !d.settled);
  const settled = wallet.debts.filter(d => d.settled);

  function save() {
    if (!form.counterparty?.trim()) { Alert.alert('Enter counterparty name'); return; }
    if (!form.amount || Number(form.amount) <= 0) { Alert.alert('Enter amount'); return; }
    Store.addDebt({
      direction:    form.direction || 'borrowed',
      counterparty: form.counterparty.trim(),
      amount:       Number(form.amount),
      currency:     form.currency || 'THB',
      dateStart:    form.dateStart || new Date().toISOString().slice(0, 10),
      dateDue:      form.dateDue,
      note:         form.note || '',
      settled:      false,
      linkedAccountId: null,
      installment:  null,
    });
    setShowAdd(false);
    setForm(EMPTY);
  }

  function settle(d: Debt) {
    Alert.alert('Settle', `Mark "${d.counterparty}" as settled?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Settle', onPress: () => Store.settleDebt(d.id, new Date().toISOString().slice(0, 10)) },
    ]);
  }

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <View style={s.headerBar}>
        <Text style={{ color: theme.fg1, fontSize: 16, fontWeight: '600' }}>Debts & Loans</Text>
        <Pressable onPress={() => setShowAdd(true)} style={[s.addBtn, { backgroundColor: theme.accent }]}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>+ Add</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        {active.length === 0 && (
          <Card><Text style={{ color: theme.fg3, textAlign: 'center', paddingVertical: 8 }}>No active debts.</Text></Card>
        )}
        {active.map(d => (
          <Card key={d.id} style={{ gap: 8 }}>
            <View style={s.debtRow}>
              <View style={[s.badge, { backgroundColor: d.direction === 'borrowed' ? theme.dangerBg : theme.successBg }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: d.direction === 'borrowed' ? theme.danger : theme.success, textTransform: 'uppercase' }}>
                  {d.direction === 'borrowed' ? 'OWE' : 'LENT'}
                </Text>
              </View>
              <Text style={[s.party, { color: theme.fg1 }]}>{d.counterparty}</Text>
              <Text style={[s.debtAmt, { color: d.direction === 'borrowed' ? theme.danger : theme.success }]}>
                {fmtCcy(d.amount, d.currency)}
              </Text>
            </View>
            {d.dateDue && <Text style={{ fontSize: 12, color: theme.fg3 }}>Due: {fmtDate(d.dateDue)}</Text>}
            {d.note    && <Text style={{ fontSize: 13, color: theme.fg2 }}>{d.note}</Text>}
            <View style={s.debtActions}>
              <Pressable onPress={() => settle(d)} style={s.settleBtn}>
                <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>Mark settled</Text>
              </Pressable>
              <Pressable onPress={() => Alert.alert('Delete', 'Remove debt?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => Store.deleteDebt(d.id) },
              ])}>
                <Text style={{ color: theme.fg4, fontSize: 13 }}>Delete</Text>
              </Pressable>
            </View>
          </Card>
        ))}

        {settled.length > 0 && (
          <>
            <Text style={[s.sectionLabel, { color: theme.fg3 }]}>Settled</Text>
            {settled.map(d => (
              <Card key={d.id} style={{ opacity: 0.5 }}>
                <View style={s.debtRow}>
                  <Text style={[s.party, { color: theme.fg2 }]}>{d.counterparty}</Text>
                  <Text style={{ color: theme.fg3, fontSize: 13 }}>{fmtCcy(d.amount, d.currency)}</Text>
                </View>
                {d.settledDate && <Text style={{ fontSize: 11, color: theme.fg3 }}>Settled {fmtDate(d.settledDate)}</Text>}
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.bgApp }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.modalHeader}>
              <Pressable onPress={() => setShowAdd(false)}><Text style={{ color: theme.accent }}>Cancel</Text></Pressable>
              <Text style={[s.modalTitle, { color: theme.fg1 }]}>New Debt</Text>
              <Pressable onPress={save}><Text style={{ color: theme.accent, fontWeight: '600' }}>Save</Text></Pressable>
            </View>
            <ScrollView style={{ padding: 16 }}>
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Direction</Text>
              <View style={s.segRow}>
                {(['borrowed', 'lent'] as const).map(d => (
                  <Pressable key={d} onPress={() => setForm(p => ({ ...p, direction: d }))}
                    style={[s.seg, form.direction === d && { backgroundColor: theme.accent }]}>
                    <Text style={{ color: form.direction === d ? '#fff' : theme.fg2, textTransform: 'capitalize' }}>
                      {d === 'borrowed' ? 'I Owe' : 'They Owe'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {[
                { label: 'Counterparty', key: 'counterparty', placeholder: 'Person or institution', ktype: 'default' as const },
                { label: 'Amount',       key: 'amount',       placeholder: '0.00', ktype: 'decimal-pad' as const },
                { label: 'Start Date',   key: 'dateStart',    placeholder: 'YYYY-MM-DD', ktype: 'default' as const },
                { label: 'Due Date',     key: 'dateDue',      placeholder: 'YYYY-MM-DD (optional)', ktype: 'default' as const },
                { label: 'Note',         key: 'note',         placeholder: 'Optional', ktype: 'default' as const },
              ].map(f => (
                <View key={f.key}>
                  <Text style={[s.inputLabel, { color: theme.fg3 }]}>{f.label}</Text>
                  <TextInput
                    value={String((form as any)[f.key] || '')}
                    onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                    placeholder={f.placeholder} placeholderTextColor={theme.fg4}
                    keyboardType={f.ktype}
                    style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
                  />
                </View>
              ))}
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Currency</Text>
              <View style={s.segRow}>
                {WALLET_CURRENCIES.map(c => (
                  <Pressable key={c} onPress={() => setForm(p => ({ ...p, currency: c }))}
                    style={[s.seg, form.currency === c && { backgroundColor: theme.accent }]}>
                    <Text style={{ color: form.currency === c ? '#fff' : theme.fg2 }}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe:     { flex: 1, backgroundColor: theme.bgApp },
    headerBar:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: theme.bgSurface, borderBottomWidth: 1, borderBottomColor: theme.border1 },
    scroll:   { padding: 16, gap: 12, paddingBottom: 32 },
    addBtn:   { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
    sectionLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    debtRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
    badge:    { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
    party:    { flex: 1, fontSize: 15, fontWeight: '600' },
    debtAmt:  { fontSize: 16, fontWeight: '700' },
    debtActions: { flexDirection: 'row', gap: 16, marginTop: 4 },
    settleBtn:{ },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border1 },
    modalTitle:  { fontSize: 17, fontWeight: '600' },
    inputLabel:  { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
    input:    { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginBottom: 2 },
    segRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    seg:      { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: theme.bgSunken, borderWidth: 1, borderColor: theme.border1 },
  });
}
