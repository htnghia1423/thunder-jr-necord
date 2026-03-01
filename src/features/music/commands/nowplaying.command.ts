import { MUSIC_COMMAND_METADATA } from '../../utility/constants/command-metadata';
import { PlaybackControlsComponent } from '../components/playback-controls.component';
import { DisTubeService } from '../services/distube.service';
import { MusicService } from '../services/music.service';
import { EmbedBuilderUtils } from '../utils/embed-builder.utils';
import { Injectable } from '@nestjs/common';
import { Context, SlashCommand } from 'necord';
import type { SlashCommandContext } from 'necord';

@Injectable()
export class NowPlayingCommand {
	constructor(
		private readonly musicService: MusicService,
		private readonly disTubeService: DisTubeService,
	) {}

	@SlashCommand({
		name: MUSIC_COMMAND_METADATA.nowplaying.name,
		description: MUSIC_COMMAND_METADATA.nowplaying.description,
	})
	public async execute(@Context() context: SlashCommandContext) {
		const [interaction] = context;

		if (!interaction.isChatInputCommand()) return;

		await interaction.deferReply();

		// Validate guild and get queue
		const validation = this.musicService.validateGuildAndGetQueue(interaction);

		if (!validation.success) {
			const errorEmbed = EmbedBuilderUtils.createErrorEmbed(validation.message);
			await interaction.editReply({ embeds: [errorEmbed] });
			return;
		}

		const { queue } = validation;

		// Create embed and buttons
		const embed = EmbedBuilderUtils.createNowPlayingEmbed(queue);
		const buttons = PlaybackControlsComponent.create({
			isPaused: queue.paused,
			hasPreviousSongs: queue.previousSongs && queue.previousSongs.length > 0,
			hasNextSongs: queue.songs.length > 1,
		});

		// Send message with buttons
		const message = await interaction.editReply({
			embeds: [embed],
			components: [buttons],
		});

		// Attach button collector
		this.disTubeService.attachPlaybackControls(message, queue as any);
	}
}
