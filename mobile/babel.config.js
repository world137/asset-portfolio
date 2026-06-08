module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated 4 ships its Babel plugin from react-native-worklets
      'react-native-worklets/plugin',
    ],
  };
};
