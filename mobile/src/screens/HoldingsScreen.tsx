import React, { useState } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet,
  Alert, TextInput, Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { PortfolioStackParams } from '../navigation/stacks/PortfolioStack';
import { useStore }  from '../hooks/useStore';
import { useTheme }  from '../hooks/useTheme';
import Card          from '../components/primitives/Card';
import Separator     from '../components/primitives/Separator';
import { fmtMoney, fmtPct, fmtQty, fmtPrice } from '../core/fmt';
import type { Position } from '../core/store';

type Props = StackScreenProps<PortfolioStackParams, 'Holdings'>;

interface LotForm {
  name: string; price: string; qty: string;
  cur: string; type: string; sector: string;
}

const EMPTY_FORM: LotForm = { name: '', price: '', qty: '', cur: '', type: '', sector: '' };

export default function HoldingsScreen({ route }: Props) {
  const { classKey } = route.params;
  const Store  = useStore();
  const { theme } = useTheme();

  const [modal, setModal]     = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId]   = useState<string | null>(null);
  const [form, setForm]       = useState<LotForm>(EMPTY_FORM);
  const [expanded, setExpanded] = useState<string | null>(null);

  const ps   = Store.positions(classKey);
  const cls  = Store.classByKey(classKey);
  const ccy  = cls?.ccy || 'THB';
  const tot  = Store.classTotals(classKey);
  const disp = Store.settings().displayCcy;

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setModal('add');
  }

  function openEditLot(lotId: string, pos: Position) {
    const lot = pos.lots.find(l => l.id === lotId);
    if (!lot) return;
    setForm({
      name: lot.name, price: String(lot.price), qty: String(lot.qty),
      cur: lot.cur != null ? String(lot.cur) : '', type: lot.type || '', sector: pos.sector || '',
    });
    setEditId(lotId);
    setModal('edit');
  }

  function submitAdd() {
    if (!form.name.trim() || !form.price || !form.qty) {
      Alert.alert('Missing fields', 'Name, price, and qty are required.');
      return;
    }
    Store.addLot(classKey, {
      name: form.name.trim(), price: parseFloat(form.price), qty: parseFloat(form.qty),
      cur: form.cur ? parseFloat(form.cur) : undefined,
      type: form.type || undefined, sector: form.sector || undefined,
    });
    setModal(null);
  }

  function submitEdit() {
    if (!editId) return;
    Store.updateLot(classKey, editId, {
      name: form.name.trim(), price: parseFloat(form.price), qty: parseFloat(form.qty),
      cur: form.cur ? parseFloat(form.cur) : undefined,
      type: form.type || undefined, sector: form.sector || undefined,
    });
    setModal(null);
  }

  function deleteLot(lotId: string, name: string) {
    Alert.alert('Delete lot', `Remove this lot of ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => Store.deleteLot(classKey, lotId) },
    ]);
  }

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {/* Header totals */}
      {tot && (
        <View style={s.header}>
          <View>
            <Text style={s.headerVal}>{fmtMoney(tot.value, disp)}</Text>
            <Text style={[s.headerPct, { color: tot.pct >= 0 ? theme.success : theme.danger }]}>
              {fmtPct(tot.pct)} · {fmtMoney(tot.profit, disp)} P/L
            </Text>
          </View>
          <Pressable onPress={openAdd} style={s.addBtn}>
            <Text style={s.addBtnText}>+ Add</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={ps}
        keyExtractor={p => p.name}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Text style={{ color: theme.fg3, fontSize: 15 }}>No positions yet.</Text>
            <Pressable onPress={openAdd} style={[s.addBtn, { marginTop: 16 }]}>
              <Text style={s.addBtnText}>+ Add first position</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item: pos }) => (
          <Card noPad style={{ overflow: 'hidden' }}>
            <Pressable
              onPress={() => setExpanded(expanded === pos.name ? null : pos.name)}
              style={s.posRow}
            >
              <View style={s.posLeft}>
                <Text style={[s.posName, { color: theme.fg1 }]}>{pos.name}</Text>
                <Text style={[s.posSub, { color: theme.fg3 }]}>
                  {fmtQty(pos.qty)} · avg {fmtPrice(pos.avgPrice, ccy)}
                </Text>
              </View>
              <View style={s.posRight}>
                <Text style={[s.posValue, { color: theme.fg1 }]}>{fmtMoney(Store.toDisplay(pos.value, ccy), disp)}</Text>
                <Text style={[s.posPct, { color: pos.pct >= 0 ? theme.success : theme.danger }]}>
                  {fmtPct(pos.pct)}
                </Text>
              </View>
            </Pressable>

            {expanded === pos.name && (
              <View style={[s.lots, { backgroundColor: theme.bgSunken }]}>
                <Separator />
                {pos.lots.map((lot, i) => (
                  <View key={lot.id}>
                    <View style={s.lotRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.lotText, { color: theme.fg2 }]}>
                          {fmtQty(lot.qty)} @ {fmtPrice(lot.price, ccy)}
                        </Text>
                        <Text style={[s.lotSub, { color: theme.fg3 }]}>
                          cur: {fmtPrice(lot.cur, ccy)} · P/L: {fmtPct(lot.pct)}
                        </Text>
                      </View>
                      <View style={s.lotActions}>
                        <Pressable onPress={() => openEditLot(lot.id, pos)} style={s.lotBtn}>
                          <Text style={{ color: theme.accent, fontSize: 13 }}>Edit</Text>
                        </Pressable>
                        <Pressable onPress={() => deleteLot(lot.id, pos.name)} style={s.lotBtn}>
                          <Text style={{ color: theme.danger, fontSize: 13 }}>Del</Text>
                        </Pressable>
                      </View>
                    </View>
                    {i < pos.lots.length - 1 && <Separator mx={12} />}
                  </View>
                ))}
              </View>
            )}
          </Card>
        )}
      />

      {/* Add / Edit modal */}
      <Modal visible={modal !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.bgApp }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.modalHeader}>
              <Pressable onPress={() => setModal(null)}>
                <Text style={{ color: theme.accent, fontSize: 16 }}>Cancel</Text>
              </Pressable>
              <Text style={[s.modalTitle, { color: theme.fg1 }]}>{modal === 'add' ? 'Add Position' : 'Edit Lot'}</Text>
              <Pressable onPress={modal === 'add' ? submitAdd : submitEdit}>
                <Text style={{ color: theme.accent, fontSize: 16, fontWeight: '600' }}>Save</Text>
              </Pressable>
            </View>
            <ScrollView style={{ padding: 16 }}>
              {[
                { label: 'Ticker / Name *', key: 'name', placeholder: 'e.g. AAPL', keyType: 'default' as const },
                { label: 'Buy Price *',     key: 'price', placeholder: '0.00', keyType: 'decimal-pad' as const },
                { label: 'Quantity *',      key: 'qty',   placeholder: '0', keyType: 'decimal-pad' as const },
                { label: 'Current Price',   key: 'cur',   placeholder: '(leave blank = use buy price)', keyType: 'decimal-pad' as const },
                { label: 'Type',            key: 'type',  placeholder: 'e.g. Stock, ETF', keyType: 'default' as const },
                { label: 'Sector',          key: 'sector',placeholder: 'e.g. Technology', keyType: 'default' as const },
              ].map(f => (
                <View key={f.key} style={{ marginBottom: 16 }}>
                  <Text style={[s.inputLabel, { color: theme.fg3 }]}>{f.label}</Text>
                  <TextInput
                    value={(form as any)[f.key]}
                    onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                    placeholder={f.placeholder}
                    placeholderTextColor={theme.fg4}
                    keyboardType={f.keyType}
                    style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
                    editable={modal === 'add' || f.key !== 'name'}
                  />
                </View>
              ))}
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
    header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: theme.bgSurface, borderBottomWidth: 1, borderBottomColor: theme.border1 },
    headerVal:{ fontSize: 22, fontWeight: '700', color: theme.fg1 },
    headerPct:{ fontSize: 13, marginTop: 2 },
    addBtn:   { backgroundColor: theme.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
    addBtnText:{ color: '#fff', fontWeight: '600', fontSize: 14 },
    posRow:   { flexDirection: 'row', padding: 14 },
    posLeft:  { flex: 1 },
    posName:  { fontSize: 15, fontWeight: '600' },
    posSub:   { fontSize: 12, marginTop: 2 },
    posRight: { alignItems: 'flex-end' },
    posValue: { fontSize: 15, fontWeight: '600' },
    posPct:   { fontSize: 12, marginTop: 2 },
    lots:     { paddingHorizontal: 14 },
    lotRow:   { flexDirection: 'row', paddingVertical: 10, alignItems: 'center' },
    lotText:  { fontSize: 13 },
    lotSub:   { fontSize: 11, marginTop: 2 },
    lotActions:{ flexDirection: 'row', gap: 8 },
    lotBtn:   { paddingHorizontal: 4 },
    modalHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border1 },
    modalTitle: { fontSize: 17, fontWeight: '600', color: theme.fg1 },
    inputLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
    input:      { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  });
}
