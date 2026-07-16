import { MusicResponse } from '../enums/music.enum';
import { PermissionFlagsBits } from 'discord.js';

import { MusicValidationUtils } from './music-validation.utils';

const permissionsFor = (granted: bigint[]) => ({
	has: (flag: bigint) => granted.includes(flag),
});

const voiceChannel = (over: Record<string, unknown> = {}): any => ({
	id: 'vc1',
	guild: {
		id: 'g1',
		members: { me: { id: 'bot' } },
	},
	permissionsFor: jest
		.fn()
		.mockReturnValue(
			permissionsFor([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]),
		),
	...over,
});

const interactionWithVoice = (channel: unknown): any => ({
	guildId: 'g1',
	user: { id: 'u1' },
	guild: {
		id: 'g1',
		members: { cache: new Map([['u1', { voice: { channel } }]]) },
	},
});

describe('MusicValidationUtils.validateBotVoicePermissions', () => {
	it('fails when the bot is not a guild member', () => {
		const channel = voiceChannel({ guild: { members: { me: null } } });
		const result = MusicValidationUtils.validateBotVoicePermissions(channel);
		expect(result.valid).toBe(false);
		expect(result.message).toBe(MusicResponse.BOT_NO_PERMISSIONS);
	});

	it('fails when permissions cannot be resolved', () => {
		const channel = voiceChannel({
			permissionsFor: jest.fn().mockReturnValue(null),
		});
		expect(
			MusicValidationUtils.validateBotVoicePermissions(channel).valid,
		).toBe(false);
	});

	it('fails when Connect or Speak is missing', () => {
		const channel = voiceChannel({
			permissionsFor: jest
				.fn()
				.mockReturnValue(permissionsFor([PermissionFlagsBits.Connect])),
		});
		expect(
			MusicValidationUtils.validateBotVoicePermissions(channel).valid,
		).toBe(false);
	});

	it('passes when Connect and Speak are granted', () => {
		expect(
			MusicValidationUtils.validateBotVoicePermissions(voiceChannel()).valid,
		).toBe(true);
	});
});

describe('MusicValidationUtils.validateBasicRequirements', () => {
	it('fails without a guild id', () => {
		const result = MusicValidationUtils.validateBasicRequirements({
			guildId: null,
		} as any);
		expect(result.success).toBe(false);
		expect(result.message).toBe(MusicResponse.GENERIC_ERROR);
	});

	it('fails when the user is not in a voice channel', () => {
		const result = MusicValidationUtils.validateBasicRequirements(
			interactionWithVoice(null),
		);
		expect(result.success).toBe(false);
		expect(result.message).toBe(MusicResponse.NOT_IN_VOICE_CHANNEL);
	});

	it('succeeds and returns the resolved voice channel', () => {
		const channel = voiceChannel();
		const result = MusicValidationUtils.validateBasicRequirements(
			interactionWithVoice(channel),
		);
		expect(result.success).toBe(true);
		expect(result.data?.guildId).toBe('g1');
		expect(result.data?.voiceChannel).toBe(channel);
	});
});

describe('MusicValidationUtils.validateGuildAndGetQueue', () => {
	it('fails without a guild', () => {
		const distube = { getQueue: jest.fn() } as any;
		const result = MusicValidationUtils.validateGuildAndGetQueue(
			{ guild: null } as any,
			distube,
		);
		expect(result.success).toBe(false);
	});

	it('fails when there is no queue', () => {
		const distube = { getQueue: jest.fn().mockReturnValue(undefined) } as any;
		const result = MusicValidationUtils.validateGuildAndGetQueue(
			{ guild: { id: 'g1' } } as any,
			distube,
		);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.message).toBe(MusicResponse.NO_QUEUE);
		}
	});

	it('returns the queue when present', () => {
		const queue = { id: 'queue' };
		const distube = { getQueue: jest.fn().mockReturnValue(queue) } as any;
		const result = MusicValidationUtils.validateGuildAndGetQueue(
			{ guild: { id: 'g1' } } as any,
			distube,
		);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.queue).toBe(queue);
		}
	});
});

describe('MusicValidationUtils.validateMusicCommand', () => {
	it('resolves the full context on the happy path', () => {
		const channel = voiceChannel();
		const queue = { id: 'queue' };
		const distube = { getQueue: jest.fn().mockReturnValue(queue) } as any;

		const result = MusicValidationUtils.validateMusicCommand(
			interactionWithVoice(channel),
			distube,
		);

		expect(result.success).toBe(true);
		expect(result.data?.queue).toBe(queue);
		expect(result.data?.voiceChannel).toBe(channel);
	});

	it('fails with NO_QUEUE when the guild has no active queue', () => {
		const distube = { getQueue: jest.fn().mockReturnValue(undefined) } as any;
		const result = MusicValidationUtils.validateMusicCommand(
			interactionWithVoice(voiceChannel()),
			distube,
		);
		expect(result.success).toBe(false);
		expect(result.message).toBe(MusicResponse.NO_QUEUE);
	});
});
