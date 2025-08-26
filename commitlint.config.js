module.exports = {
	extends: ['@commitlint/config-conventional'],
	rules: {
		'type-enum': [
			2,
			'always',
			['add', 'update', 'fix', 'docs', 'feat', 'refactor', 'delete'],
		],
		'header-max-length': [2, 'always', 300],
	},
};
