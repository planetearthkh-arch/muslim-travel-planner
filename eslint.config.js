export default [
  { ignores: ['src/**/*.ts'] },
  {
    files: ['dist/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { AbortController: 'readonly', Audio: 'readonly', console: 'readonly', document: 'readonly', DOMException: 'readonly', fetch: 'readonly', FileReader: 'readonly', FormData: 'readonly', global: 'readonly', Headers: 'readonly', history: 'readonly', HTMLInputElement: 'readonly', localStorage: 'readonly', MutationObserver: 'readonly', navigator: 'readonly', Notification: 'readonly', self: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', window: 'readonly' } },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { varsIgnorePattern: '^(CapacitorCookies|CapacitorHttp|SystemBars|a|e|n)$', argsIgnorePattern: '^(a|e|n)$' }],
      'no-constant-condition': 'error',
    },
  },
];
