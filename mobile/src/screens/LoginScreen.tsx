import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { apiAuth, hashPassword } from '../core/api';
import Store from '../core/store';

interface Props { onLogin: (portfolioId: string) => void; }

export default function LoginScreen({ onLogin }: Props) {
  const { theme } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Enter both username and password.');
      return;
    }
    setLoading(true);
    try {
      const hash = await hashPassword(password);
      const res  = await apiAuth(username.trim(), hash);
      if (res.ok && res.portfolioId) {
        await Store.setPortfolioId(res.portfolioId);
        await Store.loadWalletFromCloud();
        onLogin(res.portfolioId);
      } else {
        Alert.alert('Login failed', res.error === 'invalid-credentials'
          ? 'Invalid username or password.'
          : 'Could not connect. Try again.');
      }
    } catch {
      Alert.alert('Error', 'Network error. Please check your connection.');
    }
    setLoading(false);
  }

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.container}>
        <View style={s.card}>
          <Text style={s.title}>Portfolio</Text>
          <Text style={s.subtitle}>Sign in to your account</Text>

          <Text style={s.label}>Username</Text>
          <TextInput
            style={s.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Username"
            placeholderTextColor={theme.fg4}
            returnKeyType="next"
          />

          <Text style={s.label}>Password</Text>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor={theme.fg4}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />

          <Pressable style={[s.btn, loading && s.btnDisabled]} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Sign in</Text>
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe:      { flex: 1, backgroundColor: theme.bgApp },
    container: { flex: 1, justifyContent: 'center', padding: 24 },
    card:      {
      backgroundColor: theme.bgSurface,
      borderRadius: 16, padding: 28,
      shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 4,
    },
    title:    { fontSize: 26, fontWeight: '700', color: theme.fg1, marginBottom: 4 },
    subtitle: { fontSize: 14, color: theme.fg3, marginBottom: 28 },
    label:    { fontSize: 12, fontWeight: '600', color: theme.fg2, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
    input:    {
      borderWidth: 1, borderColor: theme.border1, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, color: theme.fg1, backgroundColor: theme.bgSunken,
      marginBottom: 16,
    },
    btn:        {
      backgroundColor: theme.accent, borderRadius: 10,
      paddingVertical: 14, alignItems: 'center', marginTop: 8,
    },
    btnDisabled: { opacity: 0.6 },
    btnText:     { color: '#fff', fontSize: 16, fontWeight: '600' },
  });
}
