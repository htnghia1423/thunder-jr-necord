import { MusicResponse } from '../enums/music.enum';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createMockInteraction } from '@test/helpers/discord';

import { DisTubeService } from './distube.service';
import { QueueManagementService } from './queue-management.service';

/**
 * Song factory producing an object shaped like the fields the service reads.
 */
const song = (over: any = {}): any => ({
	name: 'Test Song',
	url: 'https://youtu.be/test',
	duration: 200,
	formattedDuration: '03:20',
	user: { username: 'requester' },
	uploader: { name: 'Uploader' },
	...over,
});

/**
 * Interaction that satisfies the full validateMusicCommand chain
 * (guild id + member in a voice channel + bot Connect/Speak permissions).
 */
const permissiveInteraction = (): any => {
	const voiceChannel = {
		id: 'vc1',
		guild: { id: 'g1', members: { me: { id: 'bot' } } },
		permissionsFor: () => ({ has: () => true }),
	};
	return {
		guildId: 'g1',
		user: { id: 'u1' },
		guild: {
			id: 'g1',
			members: {
				cache: new Map([['u1', { voice: { channel: voiceChannel } }]]),
			},
		},
	};
};

describe('QueueManagementService', () => {
	let service: QueueManagementService;
	let mockDistube: { getQueue: jest.Mock };
	let mockDistubeService: { getDistube: jest.Mock };

	beforeAll(() => {
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	});

	beforeEach(async () => {
		mockDistube = { getQueue: jest.fn() };
		mockDistubeService = {
			getDistube: jest.fn().mockReturnValue(mockDistube),
		};

		const moduleRef = await Test.createTestingModule({
			providers: [
				QueueManagementService,
				{ provide: DisTubeService, useValue: mockDistubeService },
			],
		}).compile();

		service = moduleRef.get(QueueManagementService);
	});

	describe('skip', () => {
		it('returns the validation message when the user is not in a voice channel', async () => {
			const interaction = createMockInteraction({ voiceChannelId: null });
			const result = await service.skip(interaction);
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.NOT_IN_VOICE_CHANNEL);
		});

		it('stops playback and flags the last song when only one song remains', async () => {
			const only = song({ name: 'Only Song' });
			const queue = {
				songs: [only],
				skip: jest.fn().mockResolvedValue(undefined),
				stop: jest.fn().mockResolvedValue(undefined),
			};
			mockDistube.getQueue.mockReturnValue(queue);

			const result = await service.skip(permissiveInteraction());

			expect(queue.stop).toHaveBeenCalledTimes(1);
			expect(queue.skip).not.toHaveBeenCalled();
			expect(result.success).toBe(true);
			expect(result.message).toContain('Only Song');
			expect(result.message).toContain('Queue has ended');
			expect(result.data?.wasLastSong).toBe(true);
			expect(result.data?.nextSong).toBeNull();
			expect(result.data?.skippedSong).toBe(only);
		});

		it('skips to the next song when several songs remain', async () => {
			const current = song({ name: 'Current' });
			const next = song({ name: 'Next Up' });
			const queue = {
				songs: [current, next, song({ name: 'Third' })],
				skip: jest.fn().mockResolvedValue(undefined),
				stop: jest.fn().mockResolvedValue(undefined),
			};
			mockDistube.getQueue.mockReturnValue(queue);

			const result = await service.skip(permissiveInteraction());

			expect(queue.skip).toHaveBeenCalledTimes(1);
			expect(queue.stop).not.toHaveBeenCalled();
			expect(result.success).toBe(true);
			expect(result.message).toContain('Skipped');
			expect(result.message).toContain('Current');
			expect(result.data?.wasLastSong).toBe(false);
			expect(result.data?.skippedSong).toBe(current);
			expect(result.data?.nextSong).toBe(next);
		});

		it('returns SKIP_ERROR when queue.skip rejects', async () => {
			const queue = {
				songs: [song(), song()],
				skip: jest.fn().mockRejectedValue(new Error('skip failed')),
				stop: jest.fn(),
			};
			mockDistube.getQueue.mockReturnValue(queue);

			const result = await service.skip(permissiveInteraction());

			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.SKIP_ERROR);
		});
	});

	describe('stop', () => {
		it('returns the validation message when the user is not in a voice channel', async () => {
			const interaction = createMockInteraction({ voiceChannelId: null });
			const result = await service.stop(interaction);
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.NOT_IN_VOICE_CHANNEL);
		});

		it('stops the queue and reports playback stopped', async () => {
			const queue = {
				songs: [song()],
				stop: jest.fn().mockResolvedValue(undefined),
			};
			mockDistube.getQueue.mockReturnValue(queue);

			const result = await service.stop(permissiveInteraction());

			expect(queue.stop).toHaveBeenCalledTimes(1);
			expect(result.success).toBe(true);
			expect(result.message).toBe(MusicResponse.PLAYBACK_STOPPED);
		});

		it('returns GENERIC_ERROR when queue.stop rejects', async () => {
			const queue = {
				songs: [song()],
				stop: jest.fn().mockRejectedValue(new Error('stop failed')),
			};
			mockDistube.getQueue.mockReturnValue(queue);

			const result = await service.stop(permissiveInteraction());

			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.GENERIC_ERROR);
		});
	});

	describe('getQueue', () => {
		it('returns GENERIC_ERROR when there is no guild', async () => {
			const interaction = createMockInteraction({ guildId: null });
			const result = await service.getQueue(interaction);
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.GENERIC_ERROR);
		});

		it('returns NO_QUEUE when there is no active queue', async () => {
			mockDistube.getQueue.mockReturnValue(undefined);
			const result = await service.getQueue(createMockInteraction());
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.NO_QUEUE);
		});

		it('returns QUEUE_EMPTY when the queue has no songs', async () => {
			mockDistube.getQueue.mockReturnValue({ songs: [] });
			const result = await service.getQueue(createMockInteraction());
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.QUEUE_EMPTY);
		});

		it('lists the now playing song and upcoming queue', async () => {
			const current = song({ name: 'Now Playing Song' });
			const upcoming = song({ name: 'Second Song' });
			const queue = {
				songs: [current, upcoming, song({ name: 'Third Song' })],
			};
			mockDistube.getQueue.mockReturnValue(queue);

			const result = await service.getQueue(createMockInteraction());

			expect(result.success).toBe(true);
			expect(result.message).toContain('Now Playing Song');
			expect(result.message).toContain('Queue (2 songs)');
			expect(result.message).toContain('Second Song');
			expect(result.data?.queueLength).toBe(3);
			expect(result.data?.currentSong).toBe(current);
		});

		it('shows an overflow hint when the queue exceeds ten songs', async () => {
			const songs = Array.from({ length: 12 }, (_, i) =>
				song({ name: `Song ${i}` }),
			);
			mockDistube.getQueue.mockReturnValue({ songs });

			const result = await service.getQueue(createMockInteraction());

			expect(result.success).toBe(true);
			// songs.length (12) - 10 = 2 more songs beyond the displayed window
			expect(result.message).toContain('and 2 more songs');
			expect(result.data?.queueLength).toBe(12);
		});
	});

	describe('getNowPlaying', () => {
		const progressBar = jest.fn().mockReturnValue('[BAR]');

		beforeEach(() => progressBar.mockClear());

		it('returns GENERIC_ERROR when there is no guild', async () => {
			const interaction = createMockInteraction({ guildId: null });
			const result = await service.getNowPlaying(interaction, progressBar);
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.GENERIC_ERROR);
		});

		it('returns NO_QUEUE when there is no active queue', async () => {
			mockDistube.getQueue.mockReturnValue(undefined);
			const result = await service.getNowPlaying(
				createMockInteraction(),
				progressBar,
			);
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.NO_QUEUE);
		});

		it('returns NO_CURRENT_SONG when the queue has no current song', async () => {
			mockDistube.getQueue.mockReturnValue({ songs: [] });
			const result = await service.getNowPlaying(
				createMockInteraction(),
				progressBar,
			);
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.NO_CURRENT_SONG);
		});

		it('builds a now-playing summary with a progress bar', async () => {
			const current = song({
				name: 'Playing Now',
				url: 'https://youtu.be/current',
				duration: 200,
			});
			const queue = {
				songs: [current],
				currentTime: 100,
				formattedCurrentTime: '01:40',
			};
			mockDistube.getQueue.mockReturnValue(queue);

			const result = await service.getNowPlaying(
				createMockInteraction(),
				progressBar,
			);

			expect(progressBar).toHaveBeenCalledWith(100, 200);
			expect(result.success).toBe(true);
			expect(result.message).toContain('Playing Now');
			expect(result.message).toContain('[BAR]');
			expect(result.message).toContain('01:40');
			expect(result.message).toContain('https://youtu.be/current');
			expect(result.data?.currentTime).toBe(100);
			expect(result.data?.duration).toBe(200);
			expect(result.data?.currentSong).toBe(current);
		});
	});

	describe('removeSong', () => {
		it('returns GENERIC_ERROR when there is no guild', async () => {
			const interaction = createMockInteraction({ guildId: null });
			const result = await service.removeSong(interaction, { position: 1 });
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.GENERIC_ERROR);
		});

		it('reports an empty queue when there are no songs', async () => {
			mockDistube.getQueue.mockReturnValue({ songs: [] });
			const result = await service.removeSong(createMockInteraction(), {
				position: 1,
			});
			expect(result.success).toBe(false);
			expect(result.message).toBe('No songs in queue.');
		});

		it('removes a song by 1-based position', async () => {
			const target = song({ name: 'Target Song' });
			const queue = {
				songs: [song({ name: 'Current' }), target, song({ name: 'Third' })],
			};
			mockDistube.getQueue.mockReturnValue(queue);

			const result = await service.removeSong(createMockInteraction(), {
				position: 2,
			});

			expect(result.success).toBe(true);
			expect(result.data?.songName).toBe('Target Song');
			expect(result.data?.position).toBe(2);
			expect(result.data?.method).toBe('position');
			expect(queue.songs).toHaveLength(2);
			expect(queue.songs).not.toContain(target);
		});

		it('rejects an out-of-range position', async () => {
			const queue = { songs: [song(), song(), song()] };
			mockDistube.getQueue.mockReturnValue(queue);

			const result = await service.removeSong(createMockInteraction(), {
				position: 5,
			});

			expect(result.success).toBe(false);
			expect(result.message).toBe(
				'Invalid position. Queue has 3 songs (from 1-3).',
			);
			expect(queue.songs).toHaveLength(3);
		});

		it('refuses to remove the currently playing song (position 1)', async () => {
			const queue = { songs: [song(), song(), song()] };
			mockDistube.getQueue.mockReturnValue(queue);

			const result = await service.removeSong(createMockInteraction(), {
				position: 1,
			});

			expect(result.success).toBe(false);
			expect(result.message).toContain('Cannot remove currently playing song');
			expect(queue.songs).toHaveLength(3);
		});

		it('removes a song by name with a single fuzzy match', async () => {
			const target = song({ name: 'Alpha Track' });
			const queue = {
				songs: [song({ name: 'Now Playing' }), target, song({ name: 'Beta' })],
			};
			mockDistube.getQueue.mockReturnValue(queue);

			const result = await service.removeSong(createMockInteraction(), {
				songName: 'alpha',
			});

			expect(result.success).toBe(true);
			expect(result.data?.method).toBe('name');
			expect(result.data?.songName).toBe('Alpha Track');
			expect(result.data?.position).toBe(2);
			expect(queue.songs).not.toContain(target);
		});

		it('returns not-found when no song name matches', async () => {
			const queue = {
				songs: [song({ name: 'Now Playing' }), song({ name: 'Alpha' })],
			};
			mockDistube.getQueue.mockReturnValue(queue);

			const result = await service.removeSong(createMockInteraction(), {
				songName: 'zzz-nothing',
			});

			expect(result.success).toBe(false);
			expect(result.message).toBe('No song found with name: "zzz-nothing".');
		});

		it('asks the user to disambiguate when several songs match by name', async () => {
			const queue = {
				songs: [
					song({ name: 'Now Playing' }),
					song({ name: 'Alpha Track' }),
					song({ name: 'Beta Track' }),
				],
			};
			mockDistube.getQueue.mockReturnValue(queue);

			const result = await service.removeSong(createMockInteraction(), {
				songName: 'track',
			});

			expect(result.success).toBe(false);
			expect(result.message).toContain('Found 2 matching songs');
			expect(result.message).toContain('#2:');
			expect(result.message).toContain('#3:');
			expect(queue.songs).toHaveLength(3);
		});

		it('refuses to remove the currently playing song even when matched by name', async () => {
			const queue = {
				songs: [song({ name: 'Unique Current' }), song({ name: 'Other' })],
			};
			mockDistube.getQueue.mockReturnValue(queue);

			const result = await service.removeSong(createMockInteraction(), {
				songName: 'unique current',
			});

			expect(result.success).toBe(false);
			expect(result.message).toContain('Cannot remove currently playing song');
			expect(queue.songs).toHaveLength(2);
		});
	});

	describe('shuffle', () => {
		it('returns GENERIC_ERROR when there is no guild', async () => {
			const interaction = createMockInteraction({ guildId: null });
			const result = await service.shuffle(interaction);
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.GENERIC_ERROR);
		});

		it('returns NO_QUEUE when there is no active queue', async () => {
			mockDistube.getQueue.mockReturnValue(undefined);
			const result = await service.shuffle(createMockInteraction());
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.NO_QUEUE);
		});

		it('requires at least two songs to shuffle', async () => {
			const queue = {
				songs: [song()],
				shuffle: jest.fn().mockResolvedValue(undefined),
			};
			mockDistube.getQueue.mockReturnValue(queue);

			const result = await service.shuffle(createMockInteraction());

			expect(result.success).toBe(false);
			expect(result.message).toContain('Need at least 2 songs to shuffle');
			expect(queue.shuffle).not.toHaveBeenCalled();
		});

		it('shuffles and reports the number of shuffled songs (excluding current)', async () => {
			const queue = {
				songs: [song(), song(), song()],
				shuffle: jest.fn().mockResolvedValue(undefined),
			};
			mockDistube.getQueue.mockReturnValue(queue);

			const result = await service.shuffle(createMockInteraction());

			expect(queue.shuffle).toHaveBeenCalledTimes(1);
			expect(result.success).toBe(true);
			expect(result.message).toBe('🔀 **Shuffled 2 songs in queue**');
		});
	});
});
