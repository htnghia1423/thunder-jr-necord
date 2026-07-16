import { createMockInteraction } from '@test/helpers/discord';
import { MessageFlags } from 'discord.js';

import { PingCommand } from './ping.command';

describe('PingCommand', () => {
	it('replies with an ephemeral pong containing the websocket latency', async () => {
		const command = new PingCommand();
		const interaction = createMockInteraction({ wsPing: 123 });

		await command.onPing([interaction] as any);

		expect(interaction.reply).toHaveBeenCalledTimes(1);
		const payload = interaction.reply.mock.calls[0][0];
		expect(payload.content).toContain('Pong');
		expect(payload.content).toContain('123ms');
		expect(payload.flags).toBe(MessageFlags.Ephemeral);
	});
});
