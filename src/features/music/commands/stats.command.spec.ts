import { Logger } from '@nestjs/common';
import { createMockInteraction } from '@test/helpers/discord';
import { MessageFlags } from 'discord.js';

import { StatsCommand } from './stats.command';

jest.mock('../services/music-stats.service', () => ({
	MusicStatsService: class {},
}));

const makeInteraction = (options: Record<string, unknown> = {}): any => {
	const interaction = createMockInteraction(options);
	interaction.isChatInputCommand = jest.fn().mockReturnValue(true);
	return interaction;
};

describe('StatsCommand', () => {
	let statsService: any;
	let command: StatsCommand;

	beforeEach(() => {
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		statsService = {
			getServerStats: jest.fn(),
			getUserStats: jest.fn(),
		};
		command = new StatsCommand(statsService);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('server', () => {
		it('resolves DJ usernames and replies with a server stats embed', async () => {
			const interaction = makeInteraction();
			interaction.client.users = {
				fetch: jest.fn().mockResolvedValue({ username: 'CoolDJ' }),
			};
			statsService.getServerStats.mockResolvedValue({
				guildId: 'guild-1',
				totalPlays: 42,
				topSongs: [
					{ songTitle: 'Song A', songUrl: 'https://a', playCount: 10 },
				],
				topDJs: [{ userId: 'dj-1', username: '', playCount: 10 }],
			});

			await command.server([interaction] as any);

			expect(interaction.deferReply).toHaveBeenCalledWith();
			expect(statsService.getServerStats).toHaveBeenCalledWith('guild-1');
			expect(interaction.client.users.fetch).toHaveBeenCalledWith('dj-1');
			const payload = interaction.editReply.mock.calls[0][0];
			expect(payload.embeds[0].data.title).toBe('📊 Server Music Statistics');
		});

		it('still renders the embed when a DJ username lookup fails', async () => {
			const interaction = makeInteraction();
			interaction.client.users = {
				fetch: jest.fn().mockRejectedValue(new Error('nope')),
			};
			statsService.getServerStats.mockResolvedValue({
				guildId: 'guild-1',
				totalPlays: 5,
				topSongs: [],
				topDJs: [{ userId: 'dj-x', username: '', playCount: 5 }],
			});

			await command.server([interaction] as any);

			expect(interaction.client.users.fetch).toHaveBeenCalledTimes(1);
			const payload = interaction.editReply.mock.calls[0][0];
			expect(payload.embeds[0].data.title).toBe('📊 Server Music Statistics');
		});

		it('replies with an error embed when no music has been played yet', async () => {
			const interaction = makeInteraction();
			statsService.getServerStats.mockResolvedValue({
				guildId: 'guild-1',
				totalPlays: 0,
				topSongs: [],
				topDJs: [],
			});

			await command.server([interaction] as any);

			const payload = interaction.editReply.mock.calls[0][0];
			expect(payload.embeds[0].data.title).toBe('❌ Error');
			expect(payload.embeds[0].data.description).toContain(
				'No music has been played',
			);
		});

		it('replies with an error embed when used outside a guild', async () => {
			const interaction = makeInteraction({ guildId: null });

			await command.server([interaction] as any);

			expect(statsService.getServerStats).not.toHaveBeenCalled();
			const payload = interaction.editReply.mock.calls[0][0];
			expect(payload.embeds[0].data.description).toContain(
				'only be used in a server',
			);
		});

		it('replies with an error embed when the stats service throws', async () => {
			const interaction = makeInteraction();
			statsService.getServerStats.mockRejectedValue(new Error('db down'));

			await command.server([interaction] as any);

			const payload = interaction.editReply.mock.calls[0][0];
			expect(payload.embeds[0].data.title).toBe('❌ Error');
			expect(payload.embeds[0].data.description).toContain(
				'Failed to fetch server statistics',
			);
		});
	});

	describe('me', () => {
		it('defers ephemerally and replies with a personal stats embed', async () => {
			const interaction = makeInteraction();
			statsService.getUserStats.mockResolvedValue({
				guildId: 'guild-1',
				userId: 'user-1',
				totalPlays: 7,
				topSongs: [{ songTitle: 'Fav', songUrl: 'https://f', playCount: 7 }],
				rank: 3,
			});

			await command.me([interaction] as any);

			expect(interaction.deferReply).toHaveBeenCalledWith({
				flags: MessageFlags.Ephemeral,
			});
			expect(statsService.getUserStats).toHaveBeenCalledWith(
				'guild-1',
				'user-1',
			);
			const payload = interaction.editReply.mock.calls[0][0];
			expect(payload.embeds[0].data.title).toContain('Music Statistics');
		});

		it('replies with an error embed when the user has no plays', async () => {
			const interaction = makeInteraction();
			statsService.getUserStats.mockResolvedValue({
				guildId: 'guild-1',
				userId: 'user-1',
				totalPlays: 0,
				topSongs: [],
			});

			await command.me([interaction] as any);

			const payload = interaction.editReply.mock.calls[0][0];
			expect(payload.embeds[0].data.title).toBe('❌ Error');
			expect(payload.embeds[0].data.description).toContain(
				"haven't played any music",
			);
		});
	});
});
