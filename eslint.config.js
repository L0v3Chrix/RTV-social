// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript recommended rules
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Prettier compatibility (disables conflicting rules)
  eslintConfigPrettier,

  // Global ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs',
      '**/*.test.ts', // Test files excluded from type-checked lint
      '**/*.spec.ts',
      '**/__tests__/**',
    ],
  },

  // TypeScript files configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Error prevention
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/strict-boolean-expressions': 'off', // Too strict for now
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'warn', // Downgrade to warn for now
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'off', // Too strict for existing code
      '@typescript-eslint/restrict-template-expressions': 'off', // Too strict for existing code
      '@typescript-eslint/no-unsafe-assignment': 'off', // Too strict for existing code
      '@typescript-eslint/no-confusing-void-expression': 'off', // Too strict for existing code
      '@typescript-eslint/no-deprecated': 'warn', // Downgrade to warn
      '@typescript-eslint/require-await': 'warn', // Downgrade to warn for existing code
      '@typescript-eslint/no-unnecessary-condition': 'warn', // Downgrade to warn for existing code
      '@typescript-eslint/array-type': 'off', // Style preference, Array<T> is fine
      '@typescript-eslint/no-unnecessary-type-parameters': 'off', // Too strict for Drizzle ORM patterns
      '@typescript-eslint/no-unnecessary-type-assertion': 'off', // Too strict for existing code
      '@typescript-eslint/no-unsafe-argument': 'off', // Too strict for Drizzle ORM patterns
      '@typescript-eslint/no-unsafe-return': 'off', // Too strict for Drizzle ORM patterns
      '@typescript-eslint/no-unsafe-call': 'off', // Too strict for Drizzle ORM patterns
      '@typescript-eslint/no-unsafe-member-access': 'off', // Too strict for Drizzle ORM patterns
      '@typescript-eslint/prefer-optional-chain': 'warn', // Downgrade to warn

      // Code style
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'interface',
          format: ['PascalCase'],
        },
        {
          selector: 'typeAlias',
          format: ['PascalCase'],
        },
        {
          selector: 'enum',
          format: ['PascalCase'],
        },
        {
          selector: 'enumMember',
          format: ['UPPER_CASE', 'PascalCase'],
        },
      ],

      // Best practices
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
    },
  },

  // Test files - relaxed rules
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts', '**/scripts/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/unbound-method': 'off',
      'no-console': 'off',
    },
  },

  // Config files - allow CommonJS
  {
    files: ['*.config.js', '*.config.ts', '*.config.mjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  }
);
