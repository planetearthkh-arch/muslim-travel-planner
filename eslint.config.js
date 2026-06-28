export default [
  { ignores: ['src/**/*.ts'] },
  {
    files: ['dist/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { document: 'readonly', window: 'readonly', HTMLInputElement: 'readonly' } },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'error',
      'no-constant-condition': 'error',
    },
  },
];
