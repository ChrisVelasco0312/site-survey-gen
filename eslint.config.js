import preactConfig from 'eslint-config-preact';

export default [
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
