import { Injectable, Logger } from '@nestjs/common';
import { Context, Once } from 'necord';
import { Client } from 'discord.js';
import pkg from '../../../package.json';

@Injectable()
export class ReadyEvent {
  private readonly logger = new Logger(ReadyEvent.name);

  @Once('ready')
  public onReady(@Context() [client]: [Client<true>]) {
    this.logger.log(`${pkg.displayName} v${pkg.version} is now online as ${client.user.tag}!`);

    client.user.setActivity({
      name: `v${pkg.version} | /ping`,
      type: 3, // WATCHING
    });
  }
}
