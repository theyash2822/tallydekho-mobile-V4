// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // Three legacy "derive state in an effect" sites (create-order ×2, audit-trail) are
      // not obviously safe to restructure; keep them visible as warnings, not build breakers.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
