// Configurazione ESLint (flat config) senza dipendenze: npx eslint .
const browser = Object.fromEntries(
  [
    'window',
    'document',
    'console',
    'fetch',
    'URL',
    'URLSearchParams',
    'Blob',
    'setTimeout',
    'clearTimeout',
    'performance',
    'matchMedia',
    'confirm',
    'navigator',
  ].map(name => [name, 'readonly']),
);

export default [
  { ignores: ['lib/', 'dist/', '.claude/'] },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...browser, chrome: 'readonly', L: 'readonly' },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
    },
  },
];
