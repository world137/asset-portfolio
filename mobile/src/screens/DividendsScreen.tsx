import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Card from '../components/primitives/Card';
import KpiBox from '../components/primitives/KpiBox';
import Separator from '../components/primitives/Separator';
import Pill from '../components/primitives/Pill';
import { ccySymbol, fmtBig, fmtPrice, fmtDate, timeAgo } from '../core/fmt';
import { ASSET_CLASSES, CLASS_COLORS } from '../core/constants';
import type { Dividend } from '../core/store';

type Form = {
  classKey: string; name: string;
  exDate: string; payDate: string;
  amountPerShare: string; totalAmount: string;
  currency: string; note: string;
};

const EMPTY_FORM: Form = {
  classKey: '', name: '', exDate: '', payDate: '',
  amountPerShare: '', totalAmount: '', currency: 'THB', note: '',
};

const TODAY = new Date().toISOString().slice(0, 10);

export default function DividendsScreen() {
  const Store = useStore();
  const { theme } = useTheme();
  const s = makeStyles(theme);

  const settings = Store.settings();
  const sym = ccySymbol(settings.displayCcy);

  const [fetching, setFetching] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Dividend | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);

  // Auto-fetch on first open (store caches 6h).
  useEffect(() => {
    let alive = true;
    setFetching(true);
    Promise.resolve(Store.fetchDividends()).finally(() => { if (alive) setFetching(false); });
    return () => { alive = false; };
  }, []);

  function syncDividends() {
    setFetching(true);
    Promise.resolve(Store.fetchDividends(true)).finally(() => setFetching(false));
  }

  // Merge manual + auto. Hide an auto entry when a manual one covers the same holding + date.
  const manual = Store.getDividends();
  const auto = Store.getAutoDividends();
  const dividends: Dividend[] = [
    ...manual,
    ...auto.filter(a => !manual.some(m =>
      m.classKey === a.classKey && m.name === a.name &&
      (m.exDate === a.exDate || m.payDate === a.payDate))),
  ];
  const fetchedAt = Store.getDividendFetchedAt();

  const USDTHB = Store.get().fx.USDTHB;
  function effectiveAmount(d: Dividend): number {
    const raw = d.totalAmount
      || (d.amountPerShare
        ? d.amountPerShare * ((Store.positions(d.classKey).find(p => p.name === d.name) || { qty: 0 }).qty || 0)
        : 0);
    const inTHB = d.currency === 'USD' ? raw * USDTHB : raw;
    return Store.toDisplay(inTHB, 'THB');
  }

  const sorted = [...dividends].sort((a, b) => (a.payDate || '').localeCompare(b.payDate || ''));

  // Group by upcoming / past pay date.
  const { upcoming, past, totalUpcoming } = useMemo(() => {
    const up: Dividend[] = [];
    const pa: Dividend[] = [];
    for (const d of sorted) {
      if ((d.payDate || '') >= TODAY) up.push(d); else pa.push(d);
    }
    pa.reverse(); // most recent past first
    const totUp = up.reduce((a, d) => a + effectiveAmount(d), 0);
    return { upcoming: up, past: pa, totalUpcoming: totUp };
  }, [sorted, USDTHB, settings.displayCcy]);

  // Annual summary (current year).
  const curYear = new Date().getFullYear();
  const yearDivs = sorted.filter(d => (d.payDate || '').startsWith(String(curYear)));
  const yearTotal = yearDivs.reduce((a, d) => a + effectiveAmount(d), 0);

  // ── Add/edit form helpers ──────────────────────────────────────────────────
  const allPos = useMemo(() => {
    const out: { label: string; classKey: string; name: string; qty: number; ccy: string }[] = [];
    for (const cls of ASSET_CLASSES) {
      for (const p of Store.positions(cls.key)) {
        out.push({ label: `${cls.short} · ${p.name}`, classKey: cls.key, name: p.name, qty: p.qty, ccy: cls.ccy });
      }
    }
    return out;
  }, [Store]);

  const selectedPos = allPos.find(p => p.classKey === form.classKey && p.name === form.name);
  const calcTotal = form.amountPerShare && selectedPos
    ? (parseFloat(form.amountPerShare) * selectedPos.qty).toFixed(2)
    : '';

  function openAdd() {
    setEditItem(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(d: Dividend) {
    if (d.auto) return;
    setEditItem(d);
    setForm({
      classKey: d.classKey, name: d.name,
      exDate: d.exDate || '', payDate: d.payDate || '',
      amountPerShare: d.amountPerShare != null ? String(d.amountPerShare) : '',
      totalAmount: d.totalAmount != null ? String(d.totalAmount) : '',
      currency: d.currency || 'THB', note: d.note || '',
    });
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditItem(null); }

  function selectHolding(p: { classKey: string; name: string; ccy: string }) {
    setForm(f => ({ ...f, classKey: p.classKey, name: p.name, currency: p.ccy }));
  }

  function save() {
    if (!form.name || !form.payDate) { Alert.alert('Missing info', 'Pick a holding and a pay date.'); return; }
    const data = {
      classKey: form.classKey, name: form.name,
      exDate: form.exDate || null, payDate: form.payDate,
      currency: form.currency, note: form.note,
      amountPerShare: form.amountPerShare ? parseFloat(form.amountPerShare) : null,
      totalAmount: form.totalAmount ? parseFloat(form.totalAmount) : (calcTotal ? parseFloat(calcTotal) : null),
    };
    if (editItem) Store.updateDividend(editItem.id, data);
    else Store.addDividend(data);
    closeModal();
  }

  function confirmDelete(d: Dividend) {
    Alert.alert('Delete', `Remove dividend for ${d.name.replace(/THB$/, '')}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => Store.deleteDividend(d.id) },
    ]);
  }

  function renderRow(d: Dividend) {
    const cls = ASSET_CLASSES.find(c => c.key === d.classKey);
    const amt = effectiveAmount(d);
    return (
      <Pressable key={d.id} style={s.row} onPress={() => openEdit(d)} disabled={!!d.auto}
        onLongPress={() => !d.auto && confirmDelete(d)}>
        <View style={[s.dot, { backgroundColor: cls ? CLASS_COLORS[cls.key] : '#888' }]}>
          <Text style={s.dotTxt}>{(cls ? cls.short : '?').slice(0, 3)}</Text>
        </View>
        <View style={s.rowInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.rowName, { color: theme.fg1 }]} numberOfLines={1}>{d.name.replace(/THB$/, '')}</Text>
            {d.auto && <Pill label="auto" bg={theme.border2} color={theme.fg3} />}
          </View>
          <Text style={[s.rowMeta, { color: theme.fg3 }]}>
            Pay {fmtDate(d.payDate)}{d.exDate ? ` · Ex ${fmtDate(d.exDate)}` : ''}
            {d.amountPerShare ? ` · ${fmtPrice(d.amountPerShare, d.currency)}/sh` : ''}
          </Text>
        </View>
        <Text style={[s.rowAmt, { color: amt ? theme.success : theme.fg3 }]}>
          {amt ? sym + fmtBig(amt) : '—'}
        </Text>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <View style={s.headerBar}>
        <Text style={[s.subtitle, { color: theme.fg3 }]}>
          Synced from holdings{fetchedAt ? ` · ${timeAgo(fetchedAt)}` : ''}
        </Text>
        <Pressable onPress={openAdd} style={[s.addBtn, { backgroundColor: theme.accent }]}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>+ Add</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* KPIs */}
        <View style={s.kpiRow}>
          <KpiBox label="Upcoming income" value={sym + fmtBig(totalUpcoming)} sub={`${upcoming.length} entries`} style={s.kpi} accent={theme.success} />
          <KpiBox label={`Income ${curYear}`} value={sym + fmtBig(yearTotal)} sub={`${yearDivs.length} entries`} style={s.kpi} />
        </View>

        <Pressable onPress={syncDividends} disabled={fetching}
          style={[s.syncBtn, { borderColor: theme.border1, backgroundColor: theme.bgSurface }]}>
          {fetching && <ActivityIndicator size="small" color={theme.accent} />}
          <Text style={{ color: theme.accent, fontWeight: '600' }}>
            {fetching ? 'Refreshing…' : 'Refresh from holdings'}
          </Text>
        </Pressable>

        {/* Upcoming */}
        <Text style={s.sectionTitle}>Upcoming</Text>
        <Card noPad>
          {upcoming.length === 0
            ? <Text style={[s.empty, { color: theme.fg3 }]}>No upcoming dividends.</Text>
            : upcoming.map((d, i) => (
              <React.Fragment key={d.id}>
                {i > 0 && <Separator mx={16} />}
                {renderRow(d)}
              </React.Fragment>
            ))}
        </Card>

        {/* Past */}
        {past.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Past</Text>
            <Card noPad>
              {past.map((d, i) => (
                <React.Fragment key={d.id}>
                  {i > 0 && <Separator mx={16} />}
                  {renderRow(d)}
                </React.Fragment>
              ))}
            </Card>
          </>
        )}
      </ScrollView>

      {/* Add / edit modal */}
      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.bgApp }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.modalHeader}>
              <Pressable onPress={closeModal}><Text style={{ color: theme.accent }}>Cancel</Text></Pressable>
              <Text style={[s.modalTitle, { color: theme.fg1 }]}>{editItem ? 'Edit dividend' : 'Add dividend'}</Text>
              <Pressable onPress={save}><Text style={{ color: theme.accent, fontWeight: '600' }}>Save</Text></Pressable>
            </View>
            <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Holding</Text>
              {form.name
                ? <Text style={[s.selected, { color: theme.fg1 }]}>{selectedPos?.label || form.name}</Text>
                : null}
              <View style={s.segRow}>
                {allPos.map(p => (
                  <Pressable key={p.classKey + ':' + p.name} onPress={() => selectHolding(p)}
                    style={[s.seg, form.classKey === p.classKey && form.name === p.name && { backgroundColor: theme.accent }]}>
                    <Text style={{ color: form.classKey === p.classKey && form.name === p.name ? '#fff' : theme.fg2, fontSize: 12 }}>
                      {p.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Ex-dividend date</Text>
              <TextInput value={form.exDate} onChangeText={v => setForm(f => ({ ...f, exDate: v }))}
                placeholder="YYYY-MM-DD" placeholderTextColor={theme.fg4}
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]} />

              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Pay date *</Text>
              <TextInput value={form.payDate} onChangeText={v => setForm(f => ({ ...f, payDate: v }))}
                placeholder="YYYY-MM-DD" placeholderTextColor={theme.fg4}
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]} />

              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Amount per share</Text>
              <TextInput value={form.amountPerShare} onChangeText={v => setForm(f => ({ ...f, amountPerShare: v }))}
                placeholder="0.00" placeholderTextColor={theme.fg4} keyboardType="decimal-pad"
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]} />

              <Text style={[s.inputLabel, { color: theme.fg3 }]}>
                Total amount{calcTotal ? `  (= ${calcTotal})` : ''}
              </Text>
              <TextInput value={form.totalAmount} onChangeText={v => setForm(f => ({ ...f, totalAmount: v }))}
                placeholder={calcTotal || '0.00'} placeholderTextColor={theme.fg4} keyboardType="decimal-pad"
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]} />

              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Currency</Text>
              <View style={s.segRow}>
                {(['THB', 'USD'] as const).map(c => (
                  <Pressable key={c} onPress={() => setForm(f => ({ ...f, currency: c }))}
                    style={[s.seg, form.currency === c && { backgroundColor: theme.accent }]}>
                    <Text style={{ color: form.currency === c ? '#fff' : theme.fg2 }}>{c}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[s.inputLabel, { color: theme.fg3 }]}>Note</Text>
              <TextInput value={form.note} onChangeText={v => setForm(f => ({ ...f, note: v }))}
                placeholder="Q3 dividend, fund distribution…" placeholderTextColor={theme.fg4}
                style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]} />

              {editItem && (
                <Pressable onPress={() => { confirmDelete(editItem); }}
                  style={[s.deleteBtn, { borderColor: theme.danger }]}>
                  <Text style={{ color: theme.danger, fontWeight: '600' }}>Delete entry</Text>
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
    safe: { flex: 1, backgroundColor: theme.bgApp },
    headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border1, backgroundColor: theme.bgSurface },
    subtitle: { fontSize: 12, flex: 1 },
    addBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
    scroll: { padding: 16, gap: 12, paddingBottom: 32 },
    kpiRow: { flexDirection: 'row', gap: 10 },
    kpi: { flex: 1 },
    syncBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 11 },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.fg2, marginTop: 4 },
    empty: { textAlign: 'center', padding: 20, fontSize: 13 },
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
    dot: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    dotTxt: { color: '#fff', fontSize: 9, fontWeight: '700' },
    rowInfo: { flex: 1 },
    rowName: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
    rowMeta: { fontSize: 12, marginTop: 2 },
    rowAmt: { fontSize: 15, fontWeight: '600' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border1 },
    modalTitle: { fontSize: 17, fontWeight: '600' },
    inputLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
    selected: { fontSize: 13, marginBottom: 6 },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
    segRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    seg: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: theme.bgSunken, borderWidth: 1, borderColor: theme.border1 },
    deleteBtn: { marginTop: 24, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  });
}
