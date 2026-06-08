import React, { useEffect, useState } from 'react';
import {
  FlatList, View, Text, Pressable, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Card from '../components/primitives/Card';
import Separator from '../components/primitives/Separator';
import { fmtPrice } from '../core/fmt';
import { apiGetWatchlist, apiSaveWatchlist, type WatchlistItem } from '../core/api';
import Store from '../core/store';

export default function WatchlistScreen() {
  const _Store  = useStore();
  const { theme } = useTheme();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [ticker, setTicker] = useState('');
  const [type,   setType]   = useState('usaStock');

  useEffect(() => {
    const id = Store.getPortfolioId();
    if (id) apiGetWatchlist(id).then(setItems);
  }, []);

  async function save() {
    const newItems: WatchlistItem[] = [{ ticker: ticker.trim().toUpperCase(), type, name: ticker.trim() }, ...items];
    setItems(newItems);
    await apiSaveWatchlist(Store.getPortfolioId(), newItems);
    setTicker('');
    setShowAdd(false);
  }

  async function remove(t: string) {
    const next = items.filter(i => i.ticker !== t);
    setItems(next);
    await apiSaveWatchlist(Store.getPortfolioId(), next);
  }

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <View style={s.headerBar}>
        <Text style={{ color: theme.fg3, fontSize: 13 }}>{items.length} tickers</Text>
        <Pressable onPress={() => setShowAdd(true)} style={[s.addBtn, { backgroundColor: theme.accent }]}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>+ Add</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={i => i.ticker}
        contentContainerStyle={{ paddingBottom: 32 }}
        ItemSeparatorComponent={() => <Separator mx={16} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Text style={{ color: theme.fg3 }}>No tickers in watchlist.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.row}>
            <View style={s.info}>
              <Text style={[s.ticker, { color: theme.fg1 }]}>{item.ticker}</Text>
              <Text style={[s.type,   { color: theme.fg3 }]}>{item.type}</Text>
            </View>
            <Pressable onPress={() => Alert.alert('Remove', `Remove ${item.ticker}?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => remove(item.ticker) },
            ])}>
              <Text style={{ color: theme.fg4, fontSize: 20 }}>×</Text>
            </Pressable>
          </View>
        )}
      />

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.bgApp }}>
          <SafeAreaView style={{ flex: 1, padding: 16 }}>
            <View style={s.modalHeader}>
              <Pressable onPress={() => setShowAdd(false)}><Text style={{ color: theme.accent }}>Cancel</Text></Pressable>
              <Text style={[s.modalTitle, { color: theme.fg1 }]}>Add Ticker</Text>
              <Pressable onPress={save}><Text style={{ color: theme.accent, fontWeight: '600' }}>Add</Text></Pressable>
            </View>
            <Text style={[s.inputLabel, { color: theme.fg3 }]}>Ticker Symbol</Text>
            <TextInput
              value={ticker} onChangeText={setTicker}
              placeholder="e.g. AAPL, BTC" placeholderTextColor={theme.fg4}
              autoCapitalize="characters"
              style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
            />
            <Text style={[s.inputLabel, { color: theme.fg3 }]}>Type</Text>
            <View style={s.segRow}>
              {['usaStock', 'thaiStock', 'etf', 'fund', 'crypto'].map(t => (
                <Pressable key={t} onPress={() => setType(t)} style={[s.seg, type === t && { backgroundColor: theme.accent }]}>
                  <Text style={{ color: type === t ? '#fff' : theme.fg2, fontSize: 12 }}>{t}</Text>
                </Pressable>
              ))}
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe:    { flex: 1, backgroundColor: theme.bgApp },
    headerBar:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: theme.bgSurface, borderBottomWidth: 1, borderBottomColor: theme.border1 },
    addBtn:  { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
    row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
    info:    { flex: 1 },
    ticker:  { fontSize: 15, fontWeight: '600' },
    type:    { fontSize: 12, marginTop: 2 },
    modalHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 17, fontWeight: '600' },
    inputLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
    input:  { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
    segRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    seg:    { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: theme.bgSunken, borderWidth: 1, borderColor: theme.border1 },
  });
}
