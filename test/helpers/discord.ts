export interface MockInteractionOptions {
	userId?: string;
	userTag?: string;
	guildId?: string | null;
	voiceChannelId?: string | null;
	replied?: boolean;
	deferred?: boolean;
	wsPing?: number;
}

/**
 * Build a minimal mock of a Discord ChatInputCommandInteraction that is good
 * enough for unit-testing Necord slash command handlers. All reply-family
 * methods are jest mocks so assertions can inspect what the command sent.
 *
 * Returned as `any` on purpose — a full ChatInputCommandInteraction has a huge
 * surface we do not need for unit tests.
 */
export function createMockInteraction(
	options: MockInteractionOptions = {},
): any {
	const {
		userId = 'user-1',
		userTag = 'tester#0001',
		guildId = 'guild-1',
		voiceChannelId = 'voice-1',
		replied = false,
		deferred = false,
		wsPing = 42,
	} = options;

	const voiceChannel = voiceChannelId
		? { id: voiceChannelId, guild: { id: guildId } }
		: null;

	const member = { voice: { channel: voiceChannel } };

	return {
		user: { id: userId, tag: userTag, username: userTag },
		guildId,
		guild: guildId
			? {
					id: guildId,
					members: {
						me: { id: 'bot-1' },
						cache: new Map([[userId, member]]),
					},
				}
			: null,
		member,
		client: { ws: { ping: wsPing } },
		replied,
		deferred,
		reply: jest.fn().mockResolvedValue(undefined),
		editReply: jest.fn().mockResolvedValue(undefined),
		followUp: jest.fn().mockResolvedValue(undefined),
		deferReply: jest.fn().mockResolvedValue(undefined),
		deferUpdate: jest.fn().mockResolvedValue(undefined),
		fetchReply: jest.fn().mockResolvedValue({ id: 'message-1' }),
	};
}
