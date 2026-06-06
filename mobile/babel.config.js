module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
    ],
    // Apply private-field transforms ONLY to reanimated/worklets.
    // These packages ship compiled JS with #field syntax that Expo Go's
    // Hermes can't parse. babel-preset-expo skips this transform for the
    // hermes-stable profile. We override only for the affected packages so
    // we don't accidentally process Flow type annotations in react-native's
    // own source files (which would break DOMException setup).
    overrides: [
      {
        include: [
          /node_modules[/\\]react-native-reanimated[/\\]/,
          /node_modules[/\\]react-native-worklets[/\\]/,
        ],
        plugins: [
          ['@babel/plugin-transform-class-properties', { loose: true }],
          ['@babel/plugin-transform-private-methods', { loose: true }],
        ],
      },
    ],
  };
};
