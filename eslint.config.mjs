// eslint.config.mjs
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	// Global ignores
	{
		ignores: [
			'dist',
			'eslint.config.mjs',
			// Prisma client is generated code — never lint it. (Kept out of the
			// TS project implicitly under older tooling; make it explicit so the
			// `pnpm lint` glob / CI does not choke on generated files.)
			'src/generated/**',
		],
	},

	// Base ESLint recommended rules
	eslint.configs.recommended,

	// TypeScript specific configurations
	// This combines the parser, plugins, and type-checked rules
	...tseslint.configs.recommendedTypeChecked,

	// Prettier config must be last to override other style rules
	eslintPluginPrettierRecommended,

	// Custom configuration object
	{
		languageOptions: {
			globals: {
				...globals.node,
				...globals.jest,
			},
			parserOptions: {
				// This is the crucial fix:
				// It tells ESLint's parser to find and use the nearest tsconfig.json
				project: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// You can keep your custom rule overrides here
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-floating-promises': 'warn',
			'@typescript-eslint/no-unsafe-argument': 'warn',
		},
	},

	// Test files build their fixtures from `any`-typed mocks, so the
	// type-checked "unsafe" family is pure noise there. Disable just those
	// rules for specs/helpers; every other rule (no-floating-promises,
	// preserve-caught-error, …) stays active so real test bugs still surface.
	{
		files: ['**/*.spec.ts', 'test/**/*.ts'],
		rules: {
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/unbound-method': 'off',
			'@typescript-eslint/require-await': 'off',
		},
	},
);
