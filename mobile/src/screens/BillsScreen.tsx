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
import Separator from '../components/primitives/Separator';
import { fmtCcy, fmtBig, ccySymbol } from '../core/fmt';
import { WALLET_CURRENCIES } from '../core/constants';
import type { Bill } from '../core/store';

interface BillForm {
  name: string;
  amount: string;
  currency: string;
  dueDay: string;
  categoryId: string;
  note: string;
  active: boolean;
}

const blankForm = (): BillForm => ({
  name: '', amount: '', currency: 'THB',
  dueDay: String(new Date().getDate()),
  categoryId: '', note: '', active: true,
});

export default function BillsScreen() {
  const Store = useStore();
  const { theme } = useTheme();

  const settings = Store.settings();
  const sym      = ccySymbol(settings.displayCcy);
  const wallet   = Store.getWallet();
  const bills    = wallet.bills || [];

  const [showModal, setShowModal] = useState(false);
  const [editBill,  setEditBill]  = useState<Bill | null>(null);
  const [form,      setForm]      = useState<BillForm>(blankForm());

  const today    = new Date();
  const todayDay = today.getDate();

  const active   = bills.filter(b => b.active).sort((a, b) => a.dueDay - b.dueDay);
  const inactive = bills.filter(b => !b.active);

  // Monthly total (active bills with an amount), converted to display currency
  const monthlyTotal = active.reduce((sum, b) =>
    sum + (b.amount > 0 ? Store.walletToDisplay(b.amount, b.currency) : 0), 0);

  const daysUntilDue = (dueDay: number) => {
    const d = dueDay - todayDay;
    return d < 0 ? d + new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() : d;
  };

  const expenseCategories = (wallet.categories || []).filter(c => c.flow === 'expense');

  function openAdd() {
    setEditBill(null);
    setForm(blankForm());
    setShowModal(true);
  }

  function openEdit(b: Bill) {
    setEditBill(b);
    setForm({
      name:       b.name,
      amount:     b.amount != null ? String(b.amount) : '',
      currency:   b.currency || 'THB',
      dueDay:     String(b.dueDay || 1),
      categoryId: b.categoryId || '',
      note:       b.note || '',
      active:     b.active !== false,
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditBill(null);
  }

  function save() {
    const day = parseInt(form.dueDay, 10);
    if (!form.name.trim())          { Alert.alert('Enter a bill name'); return; }
    if (!(day >= 1 && day <= 31))   { Alert.alert('Due day must be between 1 and 31'); return; }
    const data = {
      name:       form.name.trim(),
      amount:     form.amount !== '' ? parseFloat(form.amount) || 0 : 0,
      currency:   form.currency,
      dueDay:     day,
      categoryId: form.categoryId || null,
      note:       form.note.trim(),
      active:     form.active,
    };
    if (editBill) Store.updateBill(editBill.id, data);
    else          Store.addBill(data);
    closeModal();
  }

  function confirmDelete() {
    if (!editBill) return;
    Alert.alert('Delete', 'Remove this bill?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { Store.deleteBill(editBill.id); closeModal(); } },
    ]);
  }

  const s = makeStyles(theme);

  function renderBillRow(b: Bill, dim = false) {
    const daysLeft = daysUntilDue(b.dueDay);
    const isUrgent = daysLeft <= 3;
    return (
      <Pressable key={b.id} style={[s.billRow, dim && { opacity: 0.55 }]} onPress={() => openEdit(b)}>
        <View style={[s.dayBadge, { backgroundColor: theme.bgSunken }]}>
          <Text style={[s.dayNum, { color: theme.fg2 }]}>{b.dueDay}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.billName, { color: theme.fg1 }]}>{b.name}</Text>
          {b.active ? (
            daysLeft === 0 ? (
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.danger }}>Due today</Text>
            ) : (
              <Text style={{ fontSize: 12, fontWeight: isUrgent ? '600' : '400', color: isUrgent ? theme.warning : theme.fg3 }}>
                {isUrgent ? '⚠ ' : ''}{daysLeft} day{daysLeft !== 1 ? 's' : ''}
                {b.note ? ` · ${b.note}` : ''}
              </Text>
            )
          ) : (
            b.note ? <Text style={{ fontSize: 12, color: theme.fg3 }}>{b.note}</Text> : null
          )}
        </View>
        <Text style={[s.billAmt, { color: b.amount > 0 ? theme.fg1 : theme.fg4 }]}>
          {b.amount > 0 ? fmtCcy(b.amount, b.currency) : '—'}
        </Text>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <View style={s.headerBar}>
        <Text style={[s.count, { color: theme.fg3 }]}>{active.length} active · {bills.length} total</Text>
        <Pressable onPress={openAdd} style={[s.addBtn, { backgroundColor: theme.accent }]}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>+ Add</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {bills.length === 0 ? (
          <Card>
            <Text style={{ color: theme.fg3, textAlign: 'center', paddingVertical: 16 }}>
              No bills yet. Add your recurring monthly payments to track them.
            </Text>
          </Card>
        ) : (
          <>
            <View style={s.kpis}>
              <KpiBox label="Active Bills" value={String(active.length)} accent={theme.accent} style={{ flex: 1 }} />
              <KpiBox label="Monthly Total" value={`${sym}${fmtBig(monthlyTotal)}`} style={{ flex: 1 }} />
            </View>

            {active.length > 0 && (
              <View>
                <Text style={s.sectionTitle}>Active</Text>
                <Card noPad>
                  {active.map((b, i) => (
                    <View key={b.id}>
                      {i > 0 && <Separator mx={12} />}
                      {renderBillRow(b)}
                    </View>
                  ))}
                </Card>
              </View>
            )}

            {inactive.length > 0 && (
              <View>
                <Text style={s.sectionTitle}>Inactive</Text>
                <Card noPad>
                  {inactive.map((b, i) => (
                    <View key={b.id}>
                      {i > 0 && <Separator mx={12} />}
                      {renderBillRow(b, true)}
                    </View>
                  ))}
                </Card>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.bgApp }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.modalHeader}>
              <Pressable onPress={closeModal}><Text style={{ color: theme.accent }}>Cancel</Text></Pressable>
              <Text style={[s.modalTitle, { color: theme.fg1 }]}>{editBill ? 'Edit Bill' : 'Add Bill'}</Text>
              <Pressable onPress={save}><Text style={{ color: theme.accent, fontWeight: '600' }}>Save</Text></Pressable>
            </View>
            <ScrollView style={{ padding: 16 }}>
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Bill Name</Text>
              <TextInput
                value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))}
                placeholder="e.g. Rent, Phone, Internet" placeholderTextColor={theme.fg4}
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
              />

              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Amount (optional)</Text>
              <TextInput
                value={form.amount} onChangeText={v => setForm(p => ({ ...p, amount: v }))}
                placeholder="0" placeholderTextColor={theme.fg4} keyboardType="decimal-pad"
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

              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Due Day of Month (1–31)</Text>
              <TextInput
                value={form.dueDay} onChangeText={v => setForm(p => ({ ...p, dueDay: v }))}
                placeholder="1" placeholderTextColor={theme.fg4} keyboardType="number-pad"
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
              />

              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Category (optional)</Text>
              <View style={s.segRow}>
                <Pressable onPress={() => setForm(p => ({ ...p, categoryId: '' }))}
                  style={[s.seg, form.categoryId === '' && { backgroundColor: theme.accent }]}>
                  <Text style={{ color: form.categoryId === '' ? '#fff' : theme.fg2, fontSize: 13 }}>None</Text>
                </Pressable>
                {expenseCategories.map(c => (
                  <Pressable key={c.id} onPress={() => setForm(p => ({ ...p, categoryId: c.id }))}
                    style={[s.seg, form.categoryId === c.id && { backgroundColor: theme.accent }]}>
                    <Text style={{ color: form.categoryId === c.id ? '#fff' : theme.fg2, fontSize: 13 }}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Note (optional)</Text>
              <TextInput
                value={form.note} onChangeText={v => setForm(p => ({ ...p, note: v }))}
                placeholder="e.g. Auto-debit from bank" placeholderTextColor={theme.fg4}
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
              />

              <Pressable onPress={() => setForm(p => ({ ...p, active: !p.active }))} style={s.toggleRow}>
                <View style={[s.checkbox, { borderColor: form.active ? theme.accent : theme.border2, backgroundColor: form.active ? theme.accent : 'transparent' }]}>
                  {form.active && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text>}
                </View>
                <Text style={{ color: theme.fg2, fontSize: 14, fontWeight: '500' }}>Active reminder</Text>
              </Pressable>

              {editBill && (
                <Pressable onPress={confirmDelete} style={s.deleteBtn}>
                  <Text style={{ color: theme.danger, fontWeight: '600' }}>Delete Bill</Text>
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
    scroll:  { padding: 16, gap: 16, paddingBottom: 32 },
    kpis:    { flexDirection: 'row', gap: 12 },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.fg2, marginBottom: 8 },
    billRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
    dayBadge:{ width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    dayNum:  { fontSize: 15, fontWeight: '700' },
    billName:{ fontSize: 14, fontWeight: '500' },
    billAmt: { fontSize: 15, fontWeight: '600' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border1 },
    modalTitle:  { fontSize: 17, fontWeight: '600' },
    inputLabel:  { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
    input:  { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
    segRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    seg:    { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: theme.bgSunken, borderWidth: 1, borderColor: theme.border1 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
    deleteBtn: { marginTop: 28, alignItems: 'center', paddingVertical: 12 },
  });
}
