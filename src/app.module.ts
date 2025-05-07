import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NecordModule } from 'necord';
import { IntentsBitField } from 'discord.js';
import { BotModule } from './bot.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    NecordModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const token = configService.get<string>('DISCORD_TOKEN');
        if (!token) {
          throw new Error('DISCORD_TOKEN is not defined');
        }

        const isDevelopment = configService.get('NODE_ENV') !== 'production';

        return {
          token,
          intents: [
            IntentsBitField.Flags.Guilds,
            IntentsBitField.Flags.GuildMessages,
            IntentsBitField.Flags.MessageContent,
          ],
          development: isDevelopment ? [] : false,
        };
      },
    }),
    BotModule,
  ],
})
export class AppModule {}
