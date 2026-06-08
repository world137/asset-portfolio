import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Store from '../core/store';
import LoginScreen from '../screens/LoginScreen';
import BottomTabNavigator from './BottomTabNavigator';
import { useTheme } from '../hooks/useTheme';

const AUTH_KEY = 'portfolio.authToken';

export default function RootNavigator() {
  const { theme } = useTheme();
  const [loading, setLoading]   = useState(true);
  const [authed, setAuthed]     = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const savedId = await SecureStore.getItemAsync(AUTH_KEY);
        if (savedId) {
          await Store.setPortfolioId(savedId);
          await Store.loadWalletFromCloud();
          setAuthed(true);
        }
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  async function handleLogin(portfolioId: string) {
    await SecureStore.setItemAsync(AUTH_KEY, portfolioId);
    setAuthed(true);
  }

  async function handleLogout() {
    await SecureStore.deleteItemAsync(AUTH_KEY);
    setAuthed(false);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bgApp }}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  if (!authed) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <BottomTabNavigator onLogout={handleLogout} />;
}
