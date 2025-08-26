import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'discord.js';
import { Context, Once } from 'necord';

@Injectable()
export class BotGateway {
	// Create a Logger instance with the context 'BotGateway'
	private readonly logger = new Logger(BotGateway.name);

	// Use @Once() to ensure this event only runs one time upon connection
	@Once('clientReady')
	public onReady(@Context() args: [Client<true>]) {
		const client = args[0];
		this.logger.log(`Bot is logged in as ${client.user?.username}!`);
	}
}
