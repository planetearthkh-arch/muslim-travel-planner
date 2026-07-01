export default [
  { ignores: ['dist/**', 'dist-test/**', 'node_modules/**'] },
  {
    files: ['eslint.config.js', 'scripts/**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { console: 'readonly', process: 'readonly', URL: 'readonly' } },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-constant-condition': 'error',
    },
  },
];
