// Entry point.
// 1. URL polyfill must run before ANY module (expo-asset's getManifestBaseUrl
//    assigns to url.protocol at import time; RN's built-in URL is getter-only).
import 'react-native-url-polyfill/auto';
// 2. Register the root component (App.tsx only exports it; nothing else registers it).
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
