import preactConfig from 'eslint-config-preact';

export default [
	{
		ignores: ['dist/**', 'node_modules/**', 'coverage/**']
	},
	...preactConfig,
	{
		rules: {
			// Require semicolons
			semi: ['error', 'always'],
			// Unused variables (preact config already sets this; ensure it's enforced)
			'no-unused-vars': ['error', {
				args: 'after-used',
				argsIgnorePattern: '^_',
				ignoreRestSiblings: true,
				varsIgnorePattern: '^_'
			}]
		}
	}
];
