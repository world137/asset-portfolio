import React, { useState } from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { WalletStackParams } from '../navigation/stacks/WalletStack';
import { useStore }  from '../hooks/useStore';
import { useTheme }  from '../hooks/useTheme';
import Card          from '../components/primitives/Card';
import Separator     from '../components/primitives/Separator';
import { fmtCcy, fmtMoney, fmtBig, ccySymbol } from '../core/fmt';
import { ACCOUNT_TYPES, ACCOUNT_COLORS, WALLET_CURRENCIES } from '../core/constants';
import type { WalletAccount } from '../core/store';

type Nav = StackNavigationProp<WalletStackParams>;

const EMPTY: Partial<WalletAccount> = { name: '', type: 'bank', currency: 'THB', initialBal: 0, color: ACCOUNT_COLORS[0] };

export default function WalletOverviewScreen() {
  const nav    = useNavigation<Nav>();
  const Store  = useStore();
  const { theme } = useTheme();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<WalletAccount>>(EMPTY);

  const wallet = Store.getWallet();
  const disp   = Store.settings().displayCcy;
  const sym    = ccySymbol(disp);
  const ds     = Store.debtSummary();

  function saveAccount() {
    if (!form.name?.trim()) { Alert.alert('Name required'); return; }
    Store.addAccount({
      name: form.name.trim(),
      type: (form.type || 'bank') as WalletAccount['type'],
      currency: form.currency || 'THB',
      initialBal: Number(form.initialBal) || 0,
      color: form.color || ACCOUNT_COLORS[0],
      archived: false,
    });
    setShowAdd(false);
    setForm(EMPTY);
  }

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Quick nav */}
        <View style={s.navRow}>
          {[
            { label: 'Transactions', screen: 'Transactions' },
            { label: 'Debts',        screen: 'Debts' },
            { label: 'Calendar',     screen: 'WalletCalendar' },
            { label: 'Net Worth',    screen: 'NetWorth' },
          ].map(n => (
            <Pressable
              key={n.label}
              onPress={() => nav.navigate(n.screen as any)}
              style={({ pressed }) => [s.navBtn, pressed && { opacity: 0.7 }, { backgroundColor: theme.bgSurface }]}
            >
              <Text style={{ color: theme.fg2, fontSize: 13, fontWeight: '500' }}>{n.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Debt summary */}
        {(ds.totalBorrowed > 0 || ds.totalLent > 0) && (
          <Card>
            <Text style={s.sectionTitle}>Debt Overview</Text>
            <View style={s.row}>
              {ds.totalBorrowed > 0 && (
                <View style={s.debtKpi}>
                  <Text style={[s.debtLabel, { color: theme.fg3 }]}>Owe</Text>
                  <Text style={[s.debtValue, { color: theme.danger }]}>{sym}{fmtBig(ds.totalBorrowed)}</Text>
                </View>
              )}
              {ds.totalLent > 0 && (
                <View style={s.debtKpi}>
                  <Text style={[s.debtLabel, { color: theme.fg3 }]}>Lent</Text>
                  <Text style={[s.debtValue, { color: theme.success }]}>{sym}{fmtBig(ds.totalLent)}</Text>
                </View>
              )}
            </View>
          </Card>
        )}

        {/* Accounts */}
        <View style={s.accountsHeader}>
          <Text style={s.sectionTitle}>Accounts</Text>
          <Pressable onPress={() => setShowAdd(true)} style={s.addBtn}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>+ Add</Text>
          </Pressable>
        </View>

        {wallet.accounts.filter(a => !a.archived).length === 0 && (
          <Card>
            <Text style={{ color: theme.fg3, textAlign: 'center', paddingVertical: 12 }}>No accounts yet. Add one to start tracking.</Text>
          </Card>
        )}

        {wallet.accounts.filter(a => !a.archived).map(acc => {
          const bal = Store.accountBalance(acc.id);
          return (
            <Card key={acc.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[s.accIcon, { backgroundColor: acc.color + '22', borderColor: acc.color + '44' }]}>
                <Text style={{ fontSize: 16 }}>
                  {acc.type === 'bank' ? '🏦' : acc.type === 'cash' ? '💵' : acc.type === 'credit_card' ? '💳' : '📱'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.accName, { color: theme.fg1 }]}>{acc.name}</Text>
                <Text style={[s.accType, { color: theme.fg3 }]}>
                  {ACCOUNT_TYPES.find(t => t.key === acc.type)?.label || acc.type} · {acc.currency}
                </Text>
              </View>
              <Text style={[s.accBal, { color: bal >= 0 ? theme.fg1 : theme.danger }]}>
                {bal < 0 ? '−' : ''}{fmtCcy(Math.abs(bal), acc.currency)}
              </Text>
            </Card>
          );
        })}
      </ScrollView>

      {/* Add account modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.bgApp }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.modalHeader}>
              <Pressable onPress={() => setShowAdd(false)}><Text style={{ color: theme.accent }}>Cancel</Text></Pressable>
              <Text style={[s.modalTitle, { color: theme.fg1 }]}>New Account</Text>
              <Pressable onPress={saveAccount}><Text style={{ color: theme.accent, fontWeight: '600' }}>Save</Text></Pressable>
            </View>
            <ScrollView style={{ padding: 16 }}>
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Account Name</Text>
              <TextInput
                value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))}
                placeholder="e.g. SCB Savings" placeholderTextColor={theme.fg4}
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
              />
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Type</Text>
              <View style={s.segRow}>
                {ACCOUNT_TYPES.map(t => (
                  <Pressable key={t.key} onPress={() => setForm(p => ({ ...p, type: t.key as WalletAccount['type'] }))}
                    style={[s.seg, form.type === t.key && { backgroundColor: theme.accent }]}>
                    <Text style={{ color: form.type === t.key ? '#fff' : theme.fg2, fontSize: 12 }}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Currency</Text>
              <View style={s.segRow}>
                {WALLET_CURRENCIES.map(c => (
                  <Pressable key={c} onPress={() => setForm(p => ({ ...p, currency: c }))}
                    style={[s.seg, form.currency === c && { backgroundColor: theme.accent }]}>
                    <Text style={{ color: form.currency === c ? '#fff' : theme.fg2, fontSize: 13 }}>{c}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Opening Balance</Text>
              <TextInput
                value={String(form.initialBal || '')} onChangeText={v => setForm(p => ({ ...p, initialBal: parseFloat(v) || 0 }))}
                placeholder="0" placeholderTextColor={theme.fg4} keyboardType="decimal-pad"
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
              />
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Color</Text>
              <View style={s.segRow}>
                {ACCOUNT_COLORS.map(c => (
                  <Pressable key={c} onPress={() => setForm(p => ({ ...p, color: c }))}
                    style={[s.colorDot, { backgroundColor: c, borderWidth: form.color === c ? 2 : 0, borderColor: '#fff' }]} />
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
    safe:    { flex: 1, backgroundColor: theme.bgApp },
    scroll:  { padding: 16, gap: 12, paddingBottom: 32 },
    navRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    navBtn:  { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: theme.border1 },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.fg2 },
    row:     { flexDirection: 'row', gap: 16 },
    debtKpi: {},
    debtLabel:{ fontSize: 12, color: theme.fg3 },
    debtValue:{ fontSize: 20, fontWeight: '700', marginTop: 2 },
    accountsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    addBtn:  { backgroundColor: theme.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
    accIcon: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    accName: { fontSize: 15, fontWeight: '600' },
    accType: { fontSize: 12, marginTop: 1 },
    accBal:  { fontSize: 17, fontWeight: '700' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border1 },
    modalTitle:  { fontSize: 17, fontWeight: '600' },
    inputLabel:  { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
    input:  { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
    segRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    seg:    { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: theme.bgSunken, borderWidth: 1, borderColor: theme.border1 },
    colorDot: { width: 28, height: 28, borderRadius: 14 },
  });
}
