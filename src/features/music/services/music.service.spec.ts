import { LoopMode } from '../enums/loop.enum';

import { MusicService } from './music.service';

const buildDeps = () => {
	const distube = { getQueue: jest.fn() };
	const distubeService = {
		getDistube: jest.fn().mockReturnValue(distube),
	} as any;
	const playMusicService = { play: jest.fn() } as any;
	const queueManagementService = {
		skip: jest.fn(),
		stop: jest.fn(),
		getQueue: jest.fn(),
		getNowPlaying: jest.fn(),
		removeSong: jest.fn(),
		shuffle: jest.fn(),
	} as any;
	const audioControlService = {
		createProgressBar: jest.fn(),
		setVolume: jest.fn(),
		setLoop: jest.fn(),
	} as any;

	const service = new MusicService(
		distubeService,
		playMusicService,
		queueManagementService,
		audioControlService,
	);

	return {
		service,
		distube,
		distubeService,
		playMusicService,
		queueManagementService,
		audioControlService,
	};
};

describe('MusicService.validateGuildAndGetQueue', () => {
	it('fails when the interaction has no guild id', () => {
		const { service, distubeService } = buildDeps();

		const result = service.validateGuildAndGetQueue({ guildId: null } as any);

		expect(result).toEqual({ success: false, message: 'Guild ID not found' });
		// short-circuits before ever reaching DisTube
		expect(distubeService.getDistube).not.toHaveBeenCalled();
	});

	it('fails when the guild has no active queue', () => {
		const { service, distube } = buildDeps();
		distube.getQueue.mockReturnValue(undefined);

		const result = service.validateGuildAndGetQueue({ guildId: 'g1' } as any);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.message).toBe('No music queue found');
		}
		expect(distube.getQueue).toHaveBeenCalledWith('g1');
	});

	it('returns the resolved queue when one exists', () => {
		const { service, distube } = buildDeps();
		const queue = { id: 'g1', songs: [] };
		distube.getQueue.mockReturnValue(queue);

		const result = service.validateGuildAndGetQueue({ guildId: 'g1' } as any);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.queue).toBe(queue);
		}
	});
});

describe('MusicService delegation', () => {
	it('play forwards the interaction and query to PlayMusicService and returns its result', async () => {
		const { service, playMusicService } = buildDeps();
		const interaction = { guildId: 'g1' } as any;
		const expected = { success: true, message: 'playing' };
		playMusicService.play.mockResolvedValue(expected);

		await expect(service.play(interaction, 'a song')).resolves.toBe(expected);
		expect(playMusicService.play).toHaveBeenCalledWith(interaction, 'a song');
	});

	it('skip delegates to QueueManagementService', async () => {
		const { service, queueManagementService } = buildDeps();
		const interaction = {} as any;
		const expected = { success: true, message: 'skipped' };
		queueManagementService.skip.mockResolvedValue(expected);

		await expect(service.skip(interaction)).resolves.toBe(expected);
		expect(queueManagementService.skip).toHaveBeenCalledWith(interaction);
	});

	it('stop delegates to QueueManagementService', async () => {
		const { service, queueManagementService } = buildDeps();
		const interaction = {} as any;
		const expected = { success: true, message: 'stopped' };
		queueManagementService.stop.mockResolvedValue(expected);

		await expect(service.stop(interaction)).resolves.toBe(expected);
		expect(queueManagementService.stop).toHaveBeenCalledWith(interaction);
	});

	it('getQueue delegates to QueueManagementService', async () => {
		const { service, queueManagementService } = buildDeps();
		const interaction = {} as any;
		const expected = { success: true, message: 'queue' };
		queueManagementService.getQueue.mockResolvedValue(expected);

		await expect(service.getQueue(interaction)).resolves.toBe(expected);
		expect(queueManagementService.getQueue).toHaveBeenCalledWith(interaction);
	});

	it('removeSong forwards the options object to QueueManagementService', async () => {
		const { service, queueManagementService } = buildDeps();
		const interaction = {} as any;
		const options = { position: 3 };
		const expected = { success: true, message: 'removed' };
		queueManagementService.removeSong.mockResolvedValue(expected);

		await expect(service.removeSong(interaction, options)).resolves.toBe(
			expected,
		);
		expect(queueManagementService.removeSong).toHaveBeenCalledWith(
			interaction,
			options,
		);
	});

	it('shuffle delegates to QueueManagementService', async () => {
		const { service, queueManagementService } = buildDeps();
		const interaction = {} as any;
		const expected = { success: true, message: 'shuffled' };
		queueManagementService.shuffle.mockResolvedValue(expected);

		await expect(service.shuffle(interaction)).resolves.toBe(expected);
		expect(queueManagementService.shuffle).toHaveBeenCalledWith(interaction);
	});

	it('setVolume forwards the volume to AudioControlService', async () => {
		const { service, audioControlService } = buildDeps();
		const interaction = {} as any;
		const expected = { success: true, message: 'volume' };
		audioControlService.setVolume.mockResolvedValue(expected);

		await expect(service.setVolume(interaction, 77)).resolves.toBe(expected);
		expect(audioControlService.setVolume).toHaveBeenCalledWith(interaction, 77);
	});

	it('setLoop forwards the loop mode to AudioControlService', async () => {
		const { service, audioControlService } = buildDeps();
		const interaction = {} as any;
		const expected = { success: true, message: 'loop' };
		audioControlService.setLoop.mockResolvedValue(expected);

		await expect(service.setLoop(interaction, LoopMode.SONG)).resolves.toBe(
			expected,
		);
		expect(audioControlService.setLoop).toHaveBeenCalledWith(
			interaction,
			LoopMode.SONG,
		);
	});
});

describe('MusicService.getNowPlaying', () => {
	it('delegates to QueueManagementService with a progress-bar fn backed by AudioControlService', async () => {
		const { service, queueManagementService, audioControlService } =
			buildDeps();
		const interaction = {} as any;
		const expected = { success: true, message: 'now playing' };
		queueManagementService.getNowPlaying.mockResolvedValue(expected);
		audioControlService.createProgressBar.mockReturnValue('▓▓▓░░░░░░░');

		await expect(service.getNowPlaying(interaction)).resolves.toBe(expected);

		expect(queueManagementService.getNowPlaying).toHaveBeenCalledTimes(1);
		const [passedInteraction, progressFn] =
			queueManagementService.getNowPlaying.mock.calls[0];
		expect(passedInteraction).toBe(interaction);

		// The supplied callback must delegate to AudioControlService.createProgressBar
		const bar = progressFn(30, 100);
		expect(bar).toBe('▓▓▓░░░░░░░');
		expect(audioControlService.createProgressBar).toHaveBeenCalledWith(30, 100);
	});
});
