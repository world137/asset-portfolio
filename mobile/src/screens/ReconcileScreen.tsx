import React, { useState } from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Card from '../components/primitives/Card';
import { fmtCcy } from '../core/fmt';

export default function ReconcileScreen() {
  const Store = useStore();
  const { theme } = useTheme();

  const wallet   = Store.getWallet();
  const accounts = (wallet.accounts || []).filter(a => !a.archived);

  // Per-account user-entered actual balance (raw text input).
  const [actuals, setActuals] = useState<Record<string, string>>({});

  function setActual(id: string, v: string) {
    setActuals(prev => ({ ...prev, [id]: v }));
  }

  function reconcile(accountId: string, currency: string, diff: number) {
    // Post an adjusting transaction to bring the book balance to the actual balance.
    const flow: 'income' | 'expense' = diff >= 0 ? 'income' : 'expense';
    Store.addTransaction({
      accountId,
      date:        new Date().toISOString().slice(0, 10),
      amount:      Math.abs(diff),
      flow,
      categoryId:  null,
      note:        'Balance adjustment (reconcile)',
      toAccountId: null,
      fxRate:      null,
    });
    setActual(accountId, '');
    Alert.alert('Reconciled', `Posted a ${flow} adjustment of ${fmtCcy(Math.abs(diff), currency)}.`);
  }

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[s.intro, { color: theme.fg3 }]}>
            Enter each account's real balance to compare against the computed (book) balance.
          </Text>

          {accounts.length === 0 && (
            <Card>
              <Text style={{ color: theme.fg3, textAlign: 'center', paddingVertical: 16 }}>
                No accounts to reconcile. Add an account first.
              </Text>
            </Card>
          )}

          {accounts.map(acc => {
            const book   = Store.accountBalance(acc.id);
            const raw    = actuals[acc.id] ?? '';
            const actual = raw.trim() !== '' && !isNaN(parseFloat(raw)) ? parseFloat(raw) : null;
            const diff   = actual != null ? actual - book : null;
            const balanced = diff != null && Math.abs(diff) < 0.01;

            return (
              <Card key={acc.id}>
                <View style={s.accHead}>
                  <View style={[s.dot, { backgroundColor: acc.color }]} />
                  <Text style={[s.accName, { color: theme.fg1 }]}>{acc.name}</Text>
                  <Text style={[s.accCcy, { color: theme.fg3 }]}>{acc.currency}</Text>
                </View>

                <View style={s.bookRow}>
                  <Text style={{ color: theme.fg3, fontSize: 12 }}>Book balance</Text>
                  <Text style={{ color: book >= 0 ? theme.fg1 : theme.danger, fontSize: 16, fontWeight: '700' }}>
                    {book < 0 ? '−' : ''}{fmtCcy(Math.abs(book), acc.currency)}
                  </Text>
                </View>

                <Text style={[s.inputLabel, { color: theme.fg3 }]}>Actual balance ({acc.currency})</Text>
                <TextInput
                  value={raw}
                  onChangeText={v => setActual(acc.id, v)}
                  placeholder="Enter real balance" placeholderTextColor={theme.fg4}
                  keyboardType="decimal-pad"
                  style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
                />

                {diff != null && (
                  <View style={[s.diffBox, {
                    backgroundColor: balanced ? theme.successBg : theme.dangerBg,
                    borderColor:     balanced ? theme.success : theme.danger,
                  }]}>
                    <View style={s.diffRow}>
                      <Text style={{ fontSize: 12, color: theme.fg3 }}>Difference</Text>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: balanced ? theme.success : theme.danger }}>
                        {diff >= 0 ? '+' : '−'}{fmtCcy(Math.abs(diff), acc.currency)}
                      </Text>
                    </View>
                    {balanced ? (
                      <Text style={{ fontSize: 12, color: theme.success, fontWeight: '600', marginTop: 4 }}>Balanced ✓</Text>
                    ) : (
                      <Pressable
                        onPress={() => reconcile(acc.id, acc.currency, diff)}
                        style={[s.reconcileBtn, { backgroundColor: theme.accent }]}
                      >
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                          Post {diff >= 0 ? 'income' : 'expense'} adjustment
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </Card>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe:    { flex: 1, backgroundColor: theme.bgApp },
    scroll:  { padding: 16, gap: 14, paddingBottom: 32 },
    intro:   { fontSize: 13, marginBottom: 2 },
    accHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    dot:     { width: 10, height: 10, borderRadius: 5 },
    accName: { fontSize: 15, fontWeight: '600', flex: 1 },
    accCcy:  { fontSize: 12, fontWeight: '600' },
    bookRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    inputLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 10 },
    input:   { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
    diffBox: { marginTop: 12, borderRadius: 10, borderWidth: 1.5, padding: 12 },
    diffRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    reconcileBtn: { marginTop: 10, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  });
}
