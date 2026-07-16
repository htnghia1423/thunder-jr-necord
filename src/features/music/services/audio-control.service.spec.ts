import { LoopMode } from '../enums/loop.enum';
import { MusicResponse } from '../enums/music.enum';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createMockInteraction } from '@test/helpers/discord';

import { AudioControlService } from './audio-control.service';
import { DisTubeService } from './distube.service';

describe('AudioControlService', () => {
	let service: AudioControlService;
	let mockQueue: any;
	let mockDistube: { getQueue: jest.Mock };
	let mockDistubeService: { getDistube: jest.Mock };

	beforeAll(() => {
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	});

	beforeEach(async () => {
		mockQueue = {
			setVolume: jest.fn(),
			setRepeatMode: jest.fn(),
			songs: [{ name: 'Current Song' }],
		};
		mockDistube = { getQueue: jest.fn().mockReturnValue(mockQueue) };
		mockDistubeService = {
			getDistube: jest.fn().mockReturnValue(mockDistube),
		};

		const moduleRef = await Test.createTestingModule({
			providers: [
				AudioControlService,
				{ provide: DisTubeService, useValue: mockDistubeService },
			],
		}).compile();

		service = moduleRef.get(AudioControlService);
	});

	describe('createProgressBar', () => {
		it('renders an empty bar at 0% progress', () => {
			expect(service.createProgressBar(0, 100)).toBe('░░░░░░░░░░');
		});

		it('renders a completely filled bar at 100% progress', () => {
			expect(service.createProgressBar(100, 100)).toBe('▓▓▓▓▓▓▓▓▓▓');
		});

		it('renders a half-filled bar at 50% progress', () => {
			expect(service.createProgressBar(50, 100)).toBe('▓▓▓▓▓░░░░░');
		});

		it('rounds the filled-segment count to the nearest integer', () => {
			// 25 / 100 * 10 = 2.5 -> Math.round -> 3 filled segments
			expect(service.createProgressBar(25, 100)).toBe('▓▓▓░░░░░░░');
		});
	});

	describe('setVolume', () => {
		it('returns GENERIC_ERROR when there is no guild id', async () => {
			const interaction = createMockInteraction({ guildId: null });
			const result = await service.setVolume(interaction, 50);
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.GENERIC_ERROR);
			expect(mockQueue.setVolume).not.toHaveBeenCalled();
		});

		it('returns NOT_IN_VOICE_CHANNEL when the user is not in a voice channel', async () => {
			const interaction = createMockInteraction({ voiceChannelId: null });
			const result = await service.setVolume(interaction, 50);
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.NOT_IN_VOICE_CHANNEL);
		});

		it('returns NO_QUEUE when there is no active queue', async () => {
			mockDistube.getQueue.mockReturnValue(undefined);
			const interaction = createMockInteraction();
			const result = await service.setVolume(interaction, 50);
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.NO_QUEUE);
			expect(mockQueue.setVolume).not.toHaveBeenCalled();
		});

		it('rejects a volume above 100', async () => {
			const interaction = createMockInteraction();
			const result = await service.setVolume(interaction, 150);
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.INVALID_VOLUME);
			expect(mockQueue.setVolume).not.toHaveBeenCalled();
		});

		it('rejects a negative volume', async () => {
			const interaction = createMockInteraction();
			const result = await service.setVolume(interaction, -5);
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.INVALID_VOLUME);
			expect(mockQueue.setVolume).not.toHaveBeenCalled();
		});

		it('sets the volume and returns success on the happy path', async () => {
			const interaction = createMockInteraction();
			const result = await service.setVolume(interaction, 75);
			expect(mockQueue.setVolume).toHaveBeenCalledWith(75);
			expect(result.success).toBe(true);
			expect(result.message).toBe('🔊 Volume set to 75%');
		});

		it('accepts the lower boundary volume of 0', async () => {
			const interaction = createMockInteraction();
			const result = await service.setVolume(interaction, 0);
			expect(mockQueue.setVolume).toHaveBeenCalledWith(0);
			expect(result.success).toBe(true);
			expect(result.message).toBe('🔊 Volume set to 0%');
		});

		it('accepts the upper boundary volume of 100', async () => {
			const interaction = createMockInteraction();
			const result = await service.setVolume(interaction, 100);
			expect(mockQueue.setVolume).toHaveBeenCalledWith(100);
			expect(result.success).toBe(true);
		});

		it('returns GENERIC_ERROR when queue.setVolume throws', async () => {
			mockQueue.setVolume.mockImplementation(() => {
				throw new Error('boom');
			});
			const interaction = createMockInteraction();
			const result = await service.setVolume(interaction, 50);
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.GENERIC_ERROR);
		});
	});

	describe('setLoop', () => {
		it('returns GENERIC_ERROR when there is no guild', async () => {
			const interaction = createMockInteraction({ guildId: null });
			const result = await service.setLoop(interaction, LoopMode.OFF);
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.GENERIC_ERROR);
			expect(mockQueue.setRepeatMode).not.toHaveBeenCalled();
		});

		it('returns NO_QUEUE when there is no active queue', async () => {
			mockDistube.getQueue.mockReturnValue(undefined);
			const interaction = createMockInteraction();
			const result = await service.setLoop(interaction, LoopMode.SONG);
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.NO_QUEUE);
		});

		it('turns looping off', async () => {
			const interaction = createMockInteraction();
			const result = await service.setLoop(interaction, LoopMode.OFF);
			expect(mockQueue.setRepeatMode).toHaveBeenCalledWith(LoopMode.OFF);
			expect(result.success).toBe(true);
			expect(result.message).toBe('⏹️ **Loop mode:** Loop Off');
		});

		it('enables single-song looping', async () => {
			const interaction = createMockInteraction();
			const result = await service.setLoop(interaction, LoopMode.SONG);
			expect(mockQueue.setRepeatMode).toHaveBeenCalledWith(LoopMode.SONG);
			expect(result.success).toBe(true);
			expect(result.message).toBe('🔂 **Loop mode:** Loop Song');
		});

		it('enables whole-queue looping', async () => {
			const interaction = createMockInteraction();
			const result = await service.setLoop(interaction, LoopMode.QUEUE);
			expect(mockQueue.setRepeatMode).toHaveBeenCalledWith(LoopMode.QUEUE);
			expect(result.success).toBe(true);
			expect(result.message).toBe('🔁 **Loop mode:** Loop Queue');
		});

		it('returns GENERIC_ERROR when queue.setRepeatMode throws', async () => {
			mockQueue.setRepeatMode.mockImplementation(() => {
				throw new Error('boom');
			});
			const interaction = createMockInteraction();
			const result = await service.setLoop(interaction, LoopMode.QUEUE);
			expect(result.success).toBe(false);
			expect(result.message).toBe(MusicResponse.GENERIC_ERROR);
		});
	});
});
