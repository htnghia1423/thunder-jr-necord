import { DiscordUtils } from './discord.utils';

describe('DiscordUtils', () => {
	describe('escapeMarkdown', () => {
		it('escapes Discord markdown control characters', () => {
			expect(DiscordUtils.escapeMarkdown('a*b')).toBe('a\\*b');
			expect(DiscordUtils.escapeMarkdown('a_b~c')).toBe('a\\_b\\~c');
			expect(DiscordUtils.escapeMarkdown('pipe|and`tick')).toBe(
				'pipe\\|and\\`tick',
			);
		});

		it('leaves plain text untouched', () => {
			expect(DiscordUtils.escapeMarkdown('plain text 123')).toBe(
				'plain text 123',
			);
		});
	});

	describe('truncateText', () => {
		it('returns the text unchanged when within the limit', () => {
			expect(DiscordUtils.truncateText('short')).toBe('short');
		});

		it('truncates and appends an ellipsis when over the limit', () => {
			expect(DiscordUtils.truncateText('xxxxxxxxxx', 5)).toBe('xx...');
		});
	});

	describe('formatUser', () => {
		it('returns "Unknown" for a nullish user', () => {
			expect(DiscordUtils.formatUser(null)).toBe('Unknown');
			expect(DiscordUtils.formatUser(undefined)).toBe('Unknown');
		});

		it('prefers displayName then username and escapes it', () => {
			expect(DiscordUtils.formatUser({ displayName: 'A*B' })).toBe('A\\*B');
			expect(DiscordUtils.formatUser({ username: 'Bob' })).toBe('Bob');
		});

		it('falls back to toString() for a plain string', () => {
			expect(DiscordUtils.formatUser('plain')).toBe('plain');
		});

		it('returns "Unknown" when the user throws while stringifying', () => {
			const hostile = {
				toString() {
					throw new Error('boom');
				},
			};
			expect(DiscordUtils.formatUser(hostile)).toBe('Unknown');
		});
	});

	describe('formatSongName / formatDuration', () => {
		it('delegate to escapeMarkdown', () => {
			expect(DiscordUtils.formatSongName('song*1')).toBe('song\\*1');
			expect(DiscordUtils.formatDuration('3:20')).toBe('3:20');
		});
	});
});
