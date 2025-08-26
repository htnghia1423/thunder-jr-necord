import { Injectable } from '@nestjs/common';
import { Context, SlashCommand } from 'necord';
import type { SlashCommandContext } from 'necord';

@Injectable()
export class PingCommand {
	@SlashCommand({
		name: 'ping',
		description: "Checks the bot's latency.",
	})
	public async onPing(@Context() context: SlashCommandContext) {
		const [interaction] = context;
		const latency = interaction.client.ws.ping;

		return interaction.reply({
			content: `🏓 Pong! My latency is ${latency}ms.`,
			ephemeral: true,
		});
	}
}
