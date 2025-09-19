import { LoopDto } from '../dto/music.dto';
import { LoopMode } from '../enums/loop.enum';
import { MusicService } from '../services/music.service';
import { Injectable } from '@nestjs/common';
import { Context, Options, SlashCommand } from 'necord';
import type { SlashCommandContext } from 'necord';

@Injectable()
export class LoopCommand {
	constructor(private readonly musicService: MusicService) {}

	@SlashCommand({
		name: 'loop',
		description: 'Toggle loop mode (OFF, SONG, QUEUE)',
	})
	public async execute(
		@Context() context: SlashCommandContext,
		@Options() { mode }: LoopDto,
	) {
		const [interaction] = context;

		if (!interaction.isChatInputCommand()) return;

		// Defer reply to prevent timeout
		await interaction.deferReply();

		// Convert string to LoopMode enum
		let loopMode: LoopMode;
		switch (mode) {
			case 'song':
				loopMode = LoopMode.SONG;
				break;
			case 'queue':
				loopMode = LoopMode.QUEUE;
				break;
			case 'off':
			default:
				loopMode = LoopMode.OFF;
				break;
		}

		// Delegate to MusicService
		const result = await this.musicService.setLoop(interaction, loopMode);

		await interaction.editReply({ content: result.message });
	}
}
