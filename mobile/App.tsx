import './src/polyfills';
import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { ThemeProvider, ThemeContext } from './src/navigation/ThemeContext';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemeContext.Consumer>
          {({ isDark }) => (
            <>
              <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
              <NavigationContainer>
                <RootNavigator />
              </NavigationContainer>
            </>
          )}
        </ThemeContext.Consumer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
