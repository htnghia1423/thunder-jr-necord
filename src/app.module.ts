// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IntentsBitField } from 'discord.js';
import { NecordModule, NecordModuleOptions } from 'necord';

import { BotGateway } from '@/bot.gateway';
import { MusicModule } from '@/features/music/music.module';
import { UtilityModule } from '@/features/utility/utility.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
	imports: [
		// 1. Load environment variables from the .env file
		ConfigModule.forRoot({
			isGlobal: true, // Make the ConfigModule available everywhere
		}),

		// 2. Global Prisma Database Module
		PrismaModule,

		// 3. Configure NecordModule to connect the bot
		NecordModule.forRootAsync({
			imports: [ConfigModule], // Import ConfigModule to use ConfigService
			useFactory: (configService: ConfigService): NecordModuleOptions => {
				const options: NecordModuleOptions = {
					token: configService.getOrThrow<string>('DISCORD_TOKEN'),
					intents: [
						IntentsBitField.Flags.Guilds, // Intent needed for the bot to recognize guilds
						IntentsBitField.Flags.GuildVoiceStates, // Intent needed for voice channel access
						IntentsBitField.Flags.GuildMessages, // Intent needed for text channel interaction
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

		// 4. Import your feature modules
		MusicModule,
		UtilityModule,
	],
	// 5. Register the gateway to listen for events
	providers: [BotGateway],
})
export class AppModule {}
