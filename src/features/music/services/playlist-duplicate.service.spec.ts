import { MusicResponse } from '../enums/music.enum';
import { PlaylistDuplicateAction } from '../enums/playlist-duplicate.enum';
import { PlaylistInteractionUtils } from '../utils/playlist-interaction.utils';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createMockInteraction } from '@test/helpers/discord';

import { DisTubeService } from './distube.service';
import { PlaylistDuplicateService } from './playlist-duplicate.service';

/**
 * Song factory shaped like the fields the duplicate logic reads.
 */
const song = (over: any = {}): any => ({
	name: 'Song',
	url: 'https://youtu.be/x',
	formattedDuration: '03:00',
	uploader: { name: 'Uploader' },
	...over,
});

const makeSongs = (count: number): any[] =>
	Array.from({ length: count }, (_, i) =>
		song({ url: `new-${i}`, name: `New ${i}`, uploader: { name: `U${i}` } }),
	);

describe('PlaylistDuplicateService', () => {
	let service: PlaylistDuplicateService;
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
				PlaylistDuplicateService,
				{ provide: DisTubeService, useValue: mockDistubeService },
			],
		}).compile();

		service = moduleRef.get(PlaylistDuplicateService);
	});

	describe('processPlaylistDuplicates', () => {
		it('resolves the plain success result when there are no significant duplicates', async () => {
			const currentSong = song({ name: 'Current' });
			const createSuccessResult = jest
				.fn()
				.mockReturnValue({ success: true, message: 'plain-ok' });
			const resolve = jest.fn();
			const handleSpy = jest
				.spyOn(service, 'handleSignificantPlaylistDuplicates')
				.mockResolvedValue(undefined);

			// last 2 songs (added) are all unique vs the first 2 (original queue)
			const finalQueue: any = {
				songs: [
					song({ url: 'u0', name: 'A', uploader: { name: 'X' } }),
					song({ url: 'u1', name: 'B', uploader: { name: 'Y' } }),
					song({ url: 'u2', name: 'C', uploader: { name: 'Z' } }),
					song({ url: 'u3', name: 'D', uploader: { name: 'W' } }),
				],
			};

			await service.processPlaylistDuplicates(
				{
					interaction: createMockInteraction(),
					finalQueue,
					songsAdded: 2,
					originalQueueLength: 2,
					currentSong,
					wasQueueEmpty: false,
					isPlaylist: true,
					existingQueue: null,
					resolve,
				},
				createSuccessResult,
			);

			expect(handleSpy).not.toHaveBeenCalled();
			expect(createSuccessResult).toHaveBeenCalledWith(
				currentSong,
				false,
				true,
				2,
				2,
				'',
			);
			expect(resolve).toHaveBeenCalledWith({
				success: true,
				message: 'plain-ok',
			});
		});

		it('delegates to the significant-duplicates handler when the duplicate ratio is high', async () => {
			const currentSong = song({ name: 'Current' });
			const createSuccessResult = jest.fn();
			const resolve = jest.fn();
			const existingQueue: any = { songs: [song()] };
			const interaction = createMockInteraction();
			const handleSpy = jest
				.spyOn(service, 'handleSignificantPlaylistDuplicates')
				.mockResolvedValue(undefined);

			// last 2 songs (added) duplicate the first 2 (original queue) by url
			const finalQueue: any = {
				songs: [
					song({ url: 'u0', name: 'A', uploader: { name: 'X' } }),
					song({ url: 'u1', name: 'B', uploader: { name: 'Y' } }),
					song({ url: 'u0', name: 'A', uploader: { name: 'X' } }),
					song({ url: 'u1', name: 'B', uploader: { name: 'Y' } }),
				],
			};

			await service.processPlaylistDuplicates(
				{
					interaction,
					finalQueue,
					songsAdded: 2,
					originalQueueLength: 2,
					currentSong,
					wasQueueEmpty: false,
					isPlaylist: true,
					existingQueue,
					resolve,
				},
				createSuccessResult,
			);

			expect(createSuccessResult).not.toHaveBeenCalled();
			expect(resolve).not.toHaveBeenCalled();
			expect(handleSpy).toHaveBeenCalledTimes(1);
			expect(handleSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					interaction,
					currentSong,
					wasQueueEmpty: false,
					isPlaylist: true,
					songsAdded: 2,
					existingQueue,
					resolve,
					duplicateAnalysis: expect.objectContaining({
						totalSongs: 2,
						duplicateCount: 2,
					}),
				}),
			);
		});

		it('treats a null final queue as having no duplicates', async () => {
			const currentSong = song({ name: 'Current' });
			const createSuccessResult = jest
				.fn()
				.mockReturnValue({ success: true, message: 'empty-ok' });
			const resolve = jest.fn();
			const handleSpy = jest
				.spyOn(service, 'handleSignificantPlaylistDuplicates')
				.mockResolvedValue(undefined);

			await service.processPlaylistDuplicates(
				{
					interaction: createMockInteraction(),
					finalQueue: null,
					songsAdded: 0,
					originalQueueLength: 0,
					currentSong,
					wasQueueEmpty: true,
					isPlaylist: false,
					existingQueue: null,
					resolve,
				},
				createSuccessResult,
			);

			expect(handleSpy).not.toHaveBeenCalled();
			expect(createSuccessResult).toHaveBeenCalledWith(
				currentSong,
				true,
				false,
				0,
				0,
				'',
			);
			expect(resolve).toHaveBeenCalledWith({
				success: true,
				message: 'empty-ok',
			});
		});
	});

	describe('handleSignificantPlaylistDuplicates', () => {
		const buildAnalysis = () => ({
			totalSongs: 10,
			duplicateCount: 3,
			duplicates: [
				{
					song: song({ name: 'Dup 1' }),
					existingPosition: 1,
					matchType: 'url',
				},
				{
					song: song({ name: 'Dup 2' }),
					existingPosition: 2,
					matchType: 'url',
				},
				{
					song: song({ name: 'Dup 3' }),
					existingPosition: 3,
					matchType: 'url',
				},
			],
			newSongs: makeSongs(7),
		});

		it('posts the duplicate summary and defaults to ADD_ALL on timeout', async () => {
			const analysis = buildAnalysis();
			jest
				.spyOn(PlaylistInteractionUtils, 'waitForUserChoice')
				.mockResolvedValue(null);
			const interaction = createMockInteraction();
			const resolve = jest.fn();
			const existingQueue: any = { songs: makeSongs(5) };

			await service.handleSignificantPlaylistDuplicates({
				interaction,
				duplicateAnalysis: analysis as any,
				currentSong: song({ name: 'Cur', formattedDuration: '02:00' }),
				wasQueueEmpty: false,
				isPlaylist: true,
				songsAdded: 10,
				existingQueue,
				resolve,
			});

			expect(interaction.editReply).toHaveBeenCalledTimes(1);
			expect(interaction.editReply.mock.calls[0][0].content).toContain(
				'3 duplicates out of 10 songs',
			);
			expect(PlaylistInteractionUtils.waitForUserChoice).toHaveBeenCalledWith(
				interaction,
				30000,
			);
			expect(resolve).toHaveBeenCalledTimes(1);
			const result = resolve.mock.calls[0][0];
			expect(result.success).toBe(true);
			expect(result.message).toBe(
				PlaylistInteractionUtils.generateResultMessage(
					PlaylistDuplicateAction.ADD_ALL,
					10,
					3,
					7,
				),
			);
			expect(result.data.songName).toBe('Cur');
			expect(result.data.duration).toBe('02:00');
			expect(result.data.isNowPlaying).toBe(false);
			expect(result.data.wasQueueEmpty).toBe(false);
			expect(result.data.songsAdded).toBe(10);
			// existingQueue has 5 songs -> queuePosition = 5 - 1 = 4
			expect(result.data.queuePosition).toBe(4);
		});

		it('uses queue position 0 on timeout when the queue was empty', async () => {
			const analysis = buildAnalysis();
			jest
				.spyOn(PlaylistInteractionUtils, 'waitForUserChoice')
				.mockResolvedValue(null);
			const resolve = jest.fn();

			await service.handleSignificantPlaylistDuplicates({
				interaction: createMockInteraction(),
				duplicateAnalysis: analysis as any,
				currentSong: song(),
				wasQueueEmpty: true,
				isPlaylist: true,
				songsAdded: 10,
				existingQueue: null,
				resolve,
			});

			const result = resolve.mock.calls[0][0];
			expect(result.data.isNowPlaying).toBe(true);
			expect(result.data.queuePosition).toBe(0);
		});

		it('delegates to the choice handler when the user makes a choice', async () => {
			const analysis = buildAnalysis();
			jest
				.spyOn(PlaylistInteractionUtils, 'waitForUserChoice')
				.mockResolvedValue(PlaylistDuplicateAction.NEW_ONLY);
			const sentinel = { success: true, message: 'from-choice', data: {} };
			const choiceSpy = jest
				.spyOn(service, 'handlePlaylistDuplicateChoice')
				.mockResolvedValue(sentinel as any);
			const interaction = createMockInteraction();
			const resolve = jest.fn();

			await service.handleSignificantPlaylistDuplicates({
				interaction,
				duplicateAnalysis: analysis as any,
				currentSong: song(),
				wasQueueEmpty: false,
				isPlaylist: true,
				songsAdded: 10,
				existingQueue: null,
				resolve,
			});

			expect(interaction.editReply).toHaveBeenCalledTimes(1);
			expect(choiceSpy).toHaveBeenCalledWith(
				interaction,
				PlaylistDuplicateAction.NEW_ONLY,
				analysis,
			);
			expect(resolve).toHaveBeenCalledWith(sentinel);
		});
	});

	describe('handlePlaylistDuplicateChoice', () => {
		const analysis = (over: any = {}): any => ({
			totalSongs: 4,
			duplicateCount: 2,
			duplicates: [],
			newSongs: makeSongs(2),
			...over,
		});

		it('returns GENERIC_ERROR when the interaction has no guild id', async () => {
			const result = await service.handlePlaylistDuplicateChoice(
				createMockInteraction({ guildId: null }),
				PlaylistDuplicateAction.ADD_ALL,
				analysis(),
			);
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.GENERIC_ERROR);
		});

		it('returns NO_QUEUE when there is no active queue', async () => {
			mockDistube.getQueue.mockReturnValue(undefined);
			const result = await service.handlePlaylistDuplicateChoice(
				createMockInteraction(),
				PlaylistDuplicateAction.ADD_ALL,
				analysis(),
			);
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.NO_QUEUE);
		});

		it('ADD_ALL keeps the queue intact and reports every added song', async () => {
			const queue = {
				songs: [song({ name: 'Current' }), song(), song(), song()],
			};
			mockDistube.getQueue.mockReturnValue(queue);

			const result = await service.handlePlaylistDuplicateChoice(
				createMockInteraction(),
				PlaylistDuplicateAction.ADD_ALL,
				analysis(),
			);

			expect(queue.songs).toHaveLength(4);
			expect(result.success).toBe(true);
			expect(result.data?.songsAdded).toBe(4);
			expect(result.data?.queuePosition).toBe(0);
			expect(result.data?.isPlaylist).toBe(true);
			expect(result.data?.isNowPlaying).toBe(false);
			expect(result.data?.songName).toBe('Current');
			expect(result.message).toBe(
				PlaylistInteractionUtils.generateResultMessage(
					PlaylistDuplicateAction.ADD_ALL,
					4,
					2,
					2,
				),
			);
		});

		it('NEW_ONLY removes duplicate songs but never the currently playing one', async () => {
			const cur = song({ name: 'Current', url: 'cur' });
			const dup1 = song({ name: 'Dup1', url: 'd1' });
			const keep = song({ name: 'Keep', url: 'keep' });
			const queue = { songs: [cur, dup1, keep] };
			mockDistube.getQueue.mockReturnValue(queue);

			const result = await service.handlePlaylistDuplicateChoice(
				createMockInteraction(),
				PlaylistDuplicateAction.NEW_ONLY,
				analysis({
					totalSongs: 3,
					duplicateCount: 2,
					newSongs: makeSongs(1),
					duplicates: [
						{ song: { url: 'd1' }, existingPosition: 2, matchType: 'url' },
						// this duplicate matches the currently playing song and must stay
						{ song: { url: 'cur' }, existingPosition: 1, matchType: 'url' },
					],
				}),
			);

			expect(queue.songs).toHaveLength(2);
			expect(queue.songs).toContain(cur);
			expect(queue.songs).toContain(keep);
			expect(queue.songs).not.toContain(dup1);
			expect(result.data?.songsAdded).toBe(1);
			expect(result.message).toBe(
				PlaylistInteractionUtils.generateResultMessage(
					PlaylistDuplicateAction.NEW_ONLY,
					3,
					2,
					1,
				),
			);
		});

		it('CANCEL pops the newly added songs while keeping the current song', async () => {
			const cur = song({ name: 'Current' });
			const queue = { songs: [cur, song(), song(), song()] };
			mockDistube.getQueue.mockReturnValue(queue);

			const result = await service.handlePlaylistDuplicateChoice(
				createMockInteraction(),
				PlaylistDuplicateAction.CANCEL,
				analysis({ totalSongs: 3, duplicateCount: 1, newSongs: [] }),
			);

			expect(queue.songs).toEqual([cur]);
			expect(result.data?.songsAdded).toBe(3);
			expect(result.message).toBe(
				PlaylistInteractionUtils.generateResultMessage(
					PlaylistDuplicateAction.CANCEL,
					3,
					1,
					0,
				),
			);
		});

		it('CANCEL leaves a single-song queue untouched', async () => {
			const cur = song({ name: 'Current' });
			const queue = { songs: [cur] };
			mockDistube.getQueue.mockReturnValue(queue);

			await service.handlePlaylistDuplicateChoice(
				createMockInteraction(),
				PlaylistDuplicateAction.CANCEL,
				analysis({ totalSongs: 5, duplicateCount: 1, newSongs: [] }),
			);

			expect(queue.songs).toEqual([cur]);
		});
	});
});
