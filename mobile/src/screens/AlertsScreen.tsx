import React, { useState } from 'react';
import {
  FlatList, View, Text, Pressable, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Card from '../components/primitives/Card';
import { fmtPrice } from '../core/fmt';
import { ASSET_CLASSES, CLASS_COLORS } from '../core/constants';
import type { PriceAlert } from '../core/store';

interface AlertForm {
  classKey: string;
  name: string;
  condition: 'above' | 'below';
  price: string;
  note: string;
}

const EMPTY: AlertForm = { classKey: '', name: '', condition: 'above', price: '', note: '' };

export default function AlertsScreen() {
  const Store = useStore();
  const { theme } = useTheme();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AlertForm>(EMPTY);

  const alerts = Store.getPriceAlerts();
  const active = alerts.filter(a => !a.triggered);
  const triggered = alerts.filter(a => a.triggered);

  // Positions for the currently selected asset class in the form.
  const formPositions = form.classKey ? Store.positions(form.classKey) : [];

  function openAdd() {
    setForm(EMPTY);
    setShowAdd(true);
  }

  function save() {
    if (!form.classKey || !form.name) { Alert.alert('Select a holding'); return; }
    if (!form.price || Number(form.price) <= 0) { Alert.alert('Enter a target price'); return; }
    Store.addPriceAlert({
      classKey: form.classKey,
      name: form.name,
      condition: form.condition,
      price: Number(form.price),
      note: form.note,
    });
    setShowAdd(false);
    setForm(EMPTY);
  }

  const s = makeStyles(theme);

  function renderAlert(a: PriceAlert) {
    const cls = ASSET_CLASSES.find(c => c.key === a.classKey);
    const pos = Store.positions(a.classKey).find(p => p.name === a.name);
    const cur = pos && pos.cur != null ? pos.cur : null;
    const distPct = cur != null && a.price ? ((a.price - cur) / cur) * 100 : null;
    const hitNow = cur != null && (a.condition === 'above' ? cur >= a.price : cur <= a.price);
    const condColor = a.condition === 'above' ? theme.success : theme.danger;
    const condBg = a.condition === 'above' ? theme.successBg : theme.dangerBg;

    return (
      <Pressable
        key={a.id}
        onLongPress={() => Alert.alert('Delete', 'Remove this alert?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => Store.deletePriceAlert(a.id) },
        ])}
      >
        <Card style={{ ...s.row, opacity: a.triggered ? 0.6 : 1 }}>
          <View style={[s.av, { backgroundColor: cls ? CLASS_COLORS[cls.key] : '#888' }]}>
            <Text style={s.avTxt}>{(cls ? cls.short : '?').slice(0, 3)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.nameRow}>
              <Text style={[s.name, { color: theme.fg1 }]}>{a.name.replace(/THB$/, '')}</Text>
              <Text style={[s.condBadge, { color: condColor, backgroundColor: condBg }]}>
                {a.condition === 'above' ? '▲ Above' : '▼ Below'}
              </Text>
            </View>
            <View style={s.priceRow}>
              <Text style={[s.priceLbl, { color: theme.fg3 }]}>
                Target <Text style={{ color: theme.fg1, fontWeight: '700' }}>{fmtPrice(a.price, cls?.ccy)}</Text>
              </Text>
              <Text style={[s.priceLbl, { color: theme.fg3 }]}>
                Now <Text style={{ color: hitNow ? theme.success : theme.fg2, fontWeight: '600' }}>{cur != null ? fmtPrice(cur, cls?.ccy) : '—'}</Text>
              </Text>
              {distPct !== null && (
                <Text style={{ fontSize: 12, color: Math.abs(distPct) < 2 ? theme.warning : theme.fg3 }}>
                  {(distPct >= 0 ? '+' : '') + distPct.toFixed(1) + '%'}
                </Text>
              )}
            </View>
            {!!a.note && <Text style={[s.note, { color: theme.fg3 }]}>{a.note}</Text>}
          </View>
          {a.triggered && <Text style={[s.triggeredTag, { color: theme.success }]}>✓</Text>}
        </Card>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <View style={s.headerBar}>
        <Text style={[s.count, { color: theme.fg3 }]}>{alerts.length} alerts</Text>
        <Pressable onPress={openAdd} style={[s.addBtn, { backgroundColor: theme.accent }]}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>+ Add</Text>
        </Pressable>
      </View>

      <FlatList
        data={[{ key: '__sections' }]}
        keyExtractor={i => i.key}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        renderItem={() => (
          <View style={{ gap: 12 }}>
            {alerts.length === 0 && (
              <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>🔔</Text>
                <Text style={{ color: theme.fg1, fontWeight: '600', fontSize: 15, marginBottom: 6 }}>No alerts set</Text>
                <Text style={{ color: theme.fg3, fontSize: 13, textAlign: 'center' }}>
                  Add price alerts and receive notifications when a holding hits your target price.
                </Text>
              </Card>
            )}
            {active.length > 0 && (
              <>
                <Text style={[s.sectionLbl, { color: theme.fg2 }]}>Active ({active.length})</Text>
                {active.map(renderAlert)}
              </>
            )}
            {triggered.length > 0 && (
              <>
                <Text style={[s.sectionLbl, { color: theme.success }]}>Triggered ({triggered.length})</Text>
                {triggered.map(renderAlert)}
              </>
            )}
          </View>
        )}
      />

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.bgApp }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.modalHeader}>
              <Pressable onPress={() => setShowAdd(false)}><Text style={{ color: theme.accent }}>Cancel</Text></Pressable>
              <Text style={[s.modalTitle, { color: theme.fg1 }]}>New Alert</Text>
              <Pressable onPress={save}><Text style={{ color: theme.accent, fontWeight: '600' }}>Save</Text></Pressable>
            </View>
            <ScrollView style={{ padding: 16 }}>
              {/* Asset class */}
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Asset Class</Text>
              <View style={s.segRow}>
                {ASSET_CLASSES.map(c => (
                  <Pressable key={c.key} onPress={() => setForm(p => ({ ...p, classKey: c.key, name: '' }))}
                    style={[s.seg, form.classKey === c.key && { backgroundColor: theme.accent }]}>
                    <Text style={{ color: form.classKey === c.key ? '#fff' : theme.fg2, fontSize: 13 }}>{c.short}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Holding (position) */}
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Holding</Text>
              {form.classKey === '' ? (
                <Text style={{ color: theme.fg4, fontSize: 13 }}>Select an asset class first.</Text>
              ) : formPositions.length === 0 ? (
                <Text style={{ color: theme.fg4, fontSize: 13 }}>No holdings in this class.</Text>
              ) : (
                <View style={s.segRow}>
                  {formPositions.map(p => (
                    <Pressable key={p.name} onPress={() => setForm(f => ({ ...f, name: p.name }))}
                      style={[s.seg, form.name === p.name && { backgroundColor: theme.accent }]}>
                      <Text style={{ color: form.name === p.name ? '#fff' : theme.fg2, fontSize: 13 }}>{p.name.replace(/THB$/, '')}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {(() => {
                const sel = formPositions.find(p => p.name === form.name);
                const cls = ASSET_CLASSES.find(c => c.key === form.classKey);
                if (!sel) return null;
                return (
                  <Text style={{ fontSize: 12, color: theme.fg3, marginTop: 6 }}>
                    Current price: {sel.cur != null ? fmtPrice(sel.cur, cls?.ccy) : '—'}
                  </Text>
                );
              })()}

              {/* Condition */}
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Condition</Text>
              <View style={s.segRow}>
                {([['above', '▲ Rises above'], ['below', '▼ Falls below']] as const).map(([k, l]) => (
                  <Pressable key={k} onPress={() => setForm(p => ({ ...p, condition: k }))}
                    style={[s.seg, form.condition === k && { backgroundColor: theme.accent }]}>
                    <Text style={{ color: form.condition === k ? '#fff' : theme.fg2, fontSize: 13 }}>{l}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Target price */}
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Target price</Text>
              <TextInput
                value={form.price}
                onChangeText={v => setForm(p => ({ ...p, price: v }))}
                placeholder="0.00" placeholderTextColor={theme.fg4}
                keyboardType="decimal-pad"
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
              />

              {/* Note */}
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Note</Text>
              <TextInput
                value={form.note}
                onChangeText={v => setForm(p => ({ ...p, note: v }))}
                placeholder="e.g. Support level, take profit…" placeholderTextColor={theme.fg4}
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
    sectionLbl:{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
    row:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
    av:        { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    avTxt:     { color: '#fff', fontWeight: '700', fontSize: 10 },
    nameRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
    name:      { fontWeight: '600', fontSize: 14 },
    condBadge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
    priceRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    priceLbl:  { fontSize: 12 },
    note:      { fontSize: 12, marginTop: 3 },
    triggeredTag: { fontSize: 16, fontWeight: '700' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border1 },
    modalTitle:  { fontSize: 17, fontWeight: '600' },
    inputLabel:  { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
    input:    { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
    segRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    seg:      { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: theme.bgSunken, borderWidth: 1, borderColor: theme.border1 },
  });
}
