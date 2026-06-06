import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import Card from '../components/primitives/Card';
import { apiTechnical } from '../core/api';
import { fmtNum } from '../core/fmt';

export default function TechnicalScreen() {
  const { theme } = useTheme();
  const [symbol,  setSymbol]  = useState('');
  const [loading, setLoading] = useState(false);
  const [data,    setData]    = useState<Awaited<ReturnType<typeof apiTechnical>>>(null);

  async function search() {
    if (!symbol.trim()) return;
    setLoading(true);
    setData(null);
    const res = await apiTechnical(symbol.trim().toUpperCase());
    setData(res);
    setLoading(false);
  }

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <View style={s.searchBar}>
        <TextInput
          value={symbol} onChangeText={setSymbol}
          placeholder="Ticker (e.g. AAPL)" placeholderTextColor={theme.fg4}
          autoCapitalize="characters" returnKeyType="search"
          onSubmitEditing={search}
          style={[s.input, { color: theme.fg1, borderColor: theme.border1, backgroundColor: theme.bgSunken }]}
        />
        <Pressable onPress={search} style={[s.searchBtn, { backgroundColor: theme.accent }]}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Search</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {loading && <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />}

        {!loading && !data && (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Text style={{ color: theme.fg3 }}>Enter a ticker to load technical indicators.</Text>
          </View>
        )}

        {data && (
          <>
            <Card>
              <Text style={[s.sectionTitle, { color: theme.fg1 }]}>{data.symbol} — EMA</Text>
              {[
                { label: 'EMA 20', value: data.ema.ema20.at(-1) },
                { label: 'EMA 50', value: data.ema.ema50.at(-1) },
                { label: 'EMA 200',value: data.ema.ema200.at(-1) },
              ].map(row => (
                <View key={row.label} style={s.indRow}>
                  <Text style={[s.indLabel, { color: theme.fg3 }]}>{row.label}</Text>
                  <Text style={[s.indValue, { color: theme.fg1 }]}>{fmtNum(row.value)}</Text>
                </View>
              ))}
            </Card>

            <Card>
              <Text style={[s.sectionTitle, { color: theme.fg1 }]}>RSI (14)</Text>
              {(() => {
                const rsi = data.rsi.at(-1);
                const color = rsi == null ? theme.fg3 : rsi > 70 ? theme.danger : rsi < 30 ? theme.success : theme.fg1;
                const label = rsi == null ? '—' : rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral';
                return (
                  <View style={s.indRow}>
                    <Text style={[s.indLabel, { color: theme.fg3 }]}>RSI</Text>
                    <Text style={[s.indValue, { color }]}>{fmtNum(rsi)} <Text style={{ fontSize: 12 }}>({label})</Text></Text>
                  </View>
                );
              })()}
            </Card>

            <Card>
              <Text style={[s.sectionTitle, { color: theme.fg1 }]}>MACD</Text>
              {[
                { label: 'MACD',      value: data.macd.macd.at(-1) },
                { label: 'Signal',    value: data.macd.signal.at(-1) },
                { label: 'Histogram', value: data.macd.histogram.at(-1) },
              ].map(row => {
                const v = row.value;
                return (
                  <View key={row.label} style={s.indRow}>
                    <Text style={[s.indLabel, { color: theme.fg3 }]}>{row.label}</Text>
                    <Text style={[s.indValue, { color: v == null ? theme.fg3 : v >= 0 ? theme.success : theme.danger }]}>
                      {fmtNum(v, 4)}
                    </Text>
                  </View>
                );
              })}
            </Card>

            <Card>
              <Text style={[s.sectionTitle, { color: theme.fg1 }]}>Bollinger Bands</Text>
              {[
                { label: 'Upper',  value: data.bollinger.upper.at(-1) },
                { label: 'Middle', value: data.bollinger.middle.at(-1) },
                { label: 'Lower',  value: data.bollinger.lower.at(-1) },
              ].map(row => (
                <View key={row.label} style={s.indRow}>
                  <Text style={[s.indLabel, { color: theme.fg3 }]}>{row.label}</Text>
                  <Text style={[s.indValue, { color: theme.fg1 }]}>{fmtNum(row.value)}</Text>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe:      { flex: 1, backgroundColor: theme.bgApp },
    searchBar: { flexDirection: 'row', padding: 12, gap: 10, backgroundColor: theme.bgSurface, borderBottomWidth: 1, borderBottomColor: theme.border1 },
    input:     { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
    searchBtn: { borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
    scroll:    { padding: 16, gap: 12, paddingBottom: 32 },
    sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
    indRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border1 },
    indLabel:  { fontSize: 13 },
    indValue:  { fontSize: 14, fontWeight: '600' },
  });
}
