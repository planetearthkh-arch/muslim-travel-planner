export default [
  { ignores: ['src/**/*.ts'] },
  {
    files: ['dist/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { Audio: 'readonly', console: 'readonly', document: 'readonly', fetch: 'readonly', FileReader: 'readonly', FormData: 'readonly', global: 'readonly', Headers: 'readonly', history: 'readonly', HTMLInputElement: 'readonly', localStorage: 'readonly', MutationObserver: 'readonly', navigator: 'readonly', Notification: 'readonly', self: 'readonly', URLSearchParams: 'readonly', window: 'readonly' } },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { varsIgnorePattern: '^(CapacitorCookies|CapacitorHttp|SystemBars)$' }],
      'no-constant-condition': 'error',
    },
  },
];
