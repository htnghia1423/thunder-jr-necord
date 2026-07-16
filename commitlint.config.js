module.exports = {
	extends: ['@commitlint/config-conventional'],
	rules: {
		'type-enum': [
			2,
			'always',
			[
				'add',
				'update',
				'fix',
				'docs',
				'feat',
				'refactor',
				'delete',
				'chore',
				'test',
			],
		],
		'header-max-length': [2, 'always', 200],
		'body-max-line-length': [0, 'always', 100],
	},
};
