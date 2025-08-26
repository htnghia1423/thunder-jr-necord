// eslint.config.mjs
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	// Global ignores
	{
		ignores: ['dist', 'eslint.config.mjs'],
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
);
