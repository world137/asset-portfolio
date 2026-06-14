const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Prevent Metro from hoisting into the parent directory's node_modules,
// which contains incompatible react/react-native versions.
config.watchFolders = [projectRoot];
config.resolver = config.resolver ?? {};
config.resolver.nodeModulesPaths = [path.join(projectRoot, 'node_modules')];

// Inject DOMException before React Native's own init (undici needs it)
config.serializer = config.serializer ?? {};
config.serializer.polyfillModuleNames = [
  path.join(__dirname, 'polyfills.js'),
  ...(config.serializer.polyfillModuleNames ?? []),
];

// Transform reanimated/worklets so Babel strips private class fields (#field)
config.transformer.transformIgnorePatterns = [
  'node_modules/(?!(jest-)?react-native' +
  '|@react-native(-community)?' +
  '|expo(nent)?|@expo(nent)?/(?!react-native-adapter)' +
  '|@expo-google-fonts|react-navigation|@react-navigation/.*' +
  '|@unimodules/.*|unimodules' +
  '|react-native-svg' +
  '|react-native-reanimated' +
  '|react-native-worklets' +
  ')',
];

module.exports = config;
