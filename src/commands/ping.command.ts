import { Injectable } from '@nestjs/common';
import { Context, SlashCommand } from 'necord';
import { CommandInteraction, MessageFlags } from 'discord.js';
import pkg from '../../package.json';

@Injectable()
export class PingCommand {
  @SlashCommand({
    name: 'ping',
    description: 'Ping the bot to check if it is online',
  })
  public async onPing(@Context() [interaction]: [CommandInteraction]) {
    const start = Date.now();
    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    const end = Date.now();
    const responseTime = end - start;

    await interaction.editReply({
      content: `🏓 Pong! Bot response time: ${responseTime}ms | Bot version: ${pkg.version}`,
    });
  }
}
