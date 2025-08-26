// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IntentsBitField } from 'discord.js';
import { NecordModule, NecordModuleOptions } from 'necord';

import { BotGateway } from '@/bot.gateway';
import { UtilityModule } from '@/features/utility/utility.module';

@Module({
	imports: [
		// 1. Load environment variables from the .env file
		ConfigModule.forRoot({
			isGlobal: true, // Make the ConfigModule available everywhere
		}),

		// 2. Configure NecordModule to connect the bot
		NecordModule.forRootAsync({
			imports: [ConfigModule], // Import ConfigModule to use ConfigService
			useFactory: (configService: ConfigService): NecordModuleOptions => {
				const options: NecordModuleOptions = {
					token: configService.getOrThrow<string>('DISCORD_TOKEN'),
					intents: [
						IntentsBitField.Flags.Guilds, // Intent needed for the bot to recognize guilds
					],
				};

				// Conditionally add the development property for instant command updates on a test server
				const guildId = configService.get<string>('GUILD_ID');
				if (guildId) {
					options.development = [guildId];
				}

				return options;
			},
			inject: [ConfigService], // Inject ConfigService into the factory
		}),

		// 3. Import your feature modules
		UtilityModule,
	],
	// 4. Register the gateway to listen for events
	providers: [BotGateway],
})
export class AppModule {}
