import React from 'react';
import { ScrollView, View, Text, Pressable, Switch, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../hooks/useStore';
import { useTheme } from '../hooks/useTheme';
import Card     from '../components/primitives/Card';
import Separator from '../components/primitives/Separator';
import { timeAgo } from '../core/fmt';

interface Props { onLogout: () => void; }

export default function MoreScreen({ onLogout }: Props) {
  const Store    = useStore();
  const { theme, isDark, toggle } = useTheme();
  const settings = Store.settings();
  const { status, savedAt } = Store.getDbStatus();

  function confirmLogout() {
    Alert.alert('Sign out', 'This will remove your session from this device. Your data stays in the cloud.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: onLogout },
    ]);
  }

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Sync status */}
        <Card>
          <View style={s.row}>
            <Text style={[s.label, { color: theme.fg2 }]}>Cloud Sync</Text>
            <Text style={[s.value, { color: status === 'saved' ? theme.success : status === 'error' ? theme.danger : theme.fg3 }]}>
              {status === 'saved' ? `Saved ${timeAgo(savedAt)}` : status === 'saving' ? 'Saving…' : status === 'pending' ? 'Pending…' : status === 'error' ? 'Error' : 'Idle'}
            </Text>
          </View>
          <Pressable onPress={() => Store.forceSave()} style={s.syncBtn}>
            <Text style={{ color: theme.accent, fontSize: 14, fontWeight: '500' }}>Force sync now</Text>
          </Pressable>
        </Card>

        {/* Display settings */}
        <Card>
          <Text style={[s.sectionTitle, { color: theme.fg2 }]}>Display</Text>
          <View style={s.row}>
            <Text style={[s.label, { color: theme.fg2 }]}>Dark mode</Text>
            <Switch value={isDark} onValueChange={toggle} thumbColor={isDark ? theme.accent : '#fff'} trackColor={{ true: theme.accent + '60', false: theme.border2 }} />
          </View>
          <Separator />
          <View style={s.row}>
            <Text style={[s.label, { color: theme.fg2 }]}>Currency</Text>
            <View style={s.segRow}>
              {(['THB', 'USD'] as const).map(c => (
                <Pressable
                  key={c}
                  onPress={() => Store.setSetting('displayCcy', c)}
                  style={[s.seg, settings.displayCcy === c && { backgroundColor: theme.accent }]}
                >
                  <Text style={{ color: settings.displayCcy === c ? '#fff' : theme.fg2, fontSize: 13 }}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Separator />
          <View style={s.row}>
            <Text style={[s.label, { color: theme.fg2 }]}>Hide amounts</Text>
            <Switch
              value={settings.hideAmounts}
              onValueChange={v => Store.setSetting('hideAmounts', v)}
              thumbColor={settings.hideAmounts ? theme.accent : '#fff'}
              trackColor={{ true: theme.accent + '60', false: theme.border2 }}
            />
          </View>
        </Card>

        {/* Snapshot */}
        <Card>
          <Text style={[s.sectionTitle, { color: theme.fg2 }]}>Snapshots</Text>
          <View style={s.row}>
            <Text style={[s.label, { color: theme.fg2 }]}>Saved snapshots</Text>
            <Text style={[s.value, { color: theme.fg1 }]}>{Store.getSnapshots().length}</Text>
          </View>
          <Pressable onPress={() => { Store.autoSnapshot(); Alert.alert('Snapshot taken'); }} style={s.syncBtn}>
            <Text style={{ color: theme.accent, fontSize: 14, fontWeight: '500' }}>Take snapshot now</Text>
          </Pressable>
        </Card>

        {/* Sign out */}
        <Pressable onPress={confirmLogout} style={[s.logoutBtn, { borderColor: theme.danger }]}>
          <Text style={{ color: theme.danger, fontWeight: '600', fontSize: 15 }}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe:      { flex: 1, backgroundColor: theme.bgApp },
    scroll:    { padding: 16, gap: 12, paddingBottom: 48 },
    sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, color: theme.fg3, marginBottom: 10 },
    row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
    label:     { fontSize: 15 },
    value:     { fontSize: 14 },
    syncBtn:   { marginTop: 6 },
    segRow:    { flexDirection: 'row', gap: 6 },
    seg:       { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: theme.bgSunken, borderWidth: 1, borderColor: theme.border1 },
    logoutBtn: { borderWidth: 1, borderRadius: 12, padding: 16, alignItems: 'center' },
  });
}
