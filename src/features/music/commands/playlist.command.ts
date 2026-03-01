import {
	PlaylistDeleteDto,
	PlaylistLoadDto,
	PlaylistSaveDto,
} from '../dto/playlist.dto';
import { MusicResponse } from '../enums/music.enum';
import { DisTubeService } from '../services/distube.service';
import { MusicService } from '../services/music.service';
import { PlaylistStorageService } from '../services/playlist-storage.service';
import { EmbedBuilderUtils } from '../utils/embed-builder.utils';
import { MusicValidationUtils } from '../utils/music-validation.utils';
import { Injectable, Logger } from '@nestjs/common';
import type { SlashCommandContext } from 'necord';
import {
	Context,
	Options,
	Subcommand,
	createCommandGroupDecorator,
} from 'necord';

export const PlaylistCommandDecorator = createCommandGroupDecorator({
	name: 'playlist',
	description: 'Manage your music playlists',
});

@PlaylistCommandDecorator()
@Injectable()
export class PlaylistCommand {
	private readonly logger = new Logger(PlaylistCommand.name);

	constructor(
		private readonly distubeService: DisTubeService,
		private readonly playlistStorageService: PlaylistStorageService,
		private readonly musicService: MusicService,
	) {}

	@Subcommand({
		name: 'save',
		description: 'Save the current queue as a playlist',
	})
	public async save(
		@Context() context: SlashCommandContext,
		@Options() { name }: PlaylistSaveDto,
	) {
		const [interaction] = context;
		if (!interaction.isChatInputCommand()) return;

		await interaction.deferReply({ ephemeral: true });

		try {
			// Validate basic requirements (user in voice channel)
			const basicValidation =
				MusicValidationUtils.validateBasicRequirements(interaction);

			if (!basicValidation.success) {
				const errorEmbed = EmbedBuilderUtils.createErrorEmbed(
					basicValidation.message || MusicResponse.GENERIC_ERROR,
				);
				await interaction.editReply({ embeds: [errorEmbed] });
				return;
			}

			const { guildId } = basicValidation.data!;

			// Get the current queue
			const distube = this.distubeService.getDistube();
			const queue = distube.getQueue(guildId);

			if (!queue || queue.songs.length === 0) {
				const errorEmbed = EmbedBuilderUtils.createErrorEmbed(
					MusicResponse.NO_QUEUE,
				);
				await interaction.editReply({ embeds: [errorEmbed] });
				return;
			}

			// Prepare playlist data
			const userId = interaction.user.id;
			const username = interaction.user.username;
			const songs = queue.songs.map((song) => ({
				title: song.name || 'Unknown',
				url: song.url || '',
				duration: song.duration,
				thumbnail: song.thumbnail,
				uploader: song.uploader?.name,
			}));

			// Save playlist to database
			await this.playlistStorageService.savePlaylist({
				userId,
				username,
				playlistName: name,
				songs,
			});

			// Send success embed
			const embed = EmbedBuilderUtils.createPlaylistSavedEmbed(
				name,
				songs.length,
				username,
			);
			await interaction.editReply({ embeds: [embed] });

			this.logger.log(
				`User ${username} (${userId}) saved playlist "${name}" with ${songs.length} songs`,
			);
		} catch (error) {
			this.logger.error(`Failed to save playlist: ${error}`);
			const errorEmbed = EmbedBuilderUtils.createErrorEmbed(
				'Failed to save playlist. Please try again.',
			);
			await interaction.editReply({ embeds: [errorEmbed] });
		}
	}

	@Subcommand({
		name: 'load',
		description: 'Load a saved playlist into the queue',
	})
	public async load(
		@Context() context: SlashCommandContext,
		@Options() { name }: PlaylistLoadDto,
	) {
		const [interaction] = context;
		if (!interaction.isChatInputCommand()) return;

		await interaction.deferReply();

		try {
			// Validate basic requirements (user in voice channel)
			const basicValidation =
				MusicValidationUtils.validateBasicRequirements(interaction);

			if (!basicValidation.success) {
				const errorEmbed = EmbedBuilderUtils.createErrorEmbed(
					basicValidation.message || MusicResponse.GENERIC_ERROR,
				);
				await interaction.editReply({ embeds: [errorEmbed] });
				return;
			}

			// Load playlist from database
			const userId = interaction.user.id;
			const playlist = await this.playlistStorageService.loadPlaylist(
				userId,
				name,
			);

			if (!playlist) {
				const errorEmbed = EmbedBuilderUtils.createErrorEmbed(
					`Playlist **${name}** not found. Use \`/playlist list\` to see your playlists.`,
				);
				await interaction.editReply({ embeds: [errorEmbed] });
				return;
			}

			// Send loading confirmation
			const loadingEmbed = EmbedBuilderUtils.createPlaylistLoadedEmbed(
				name,
				playlist.songs.length,
			);
			await interaction.editReply({ embeds: [loadingEmbed] });

			// Load songs into the queue sequentially
			for (const song of playlist.songs) {
				try {
					await this.musicService.play(interaction, song.url);
					// Small delay between songs to avoid rate limiting
					await new Promise((resolve) => setTimeout(resolve, 500));
				} catch (error) {
					this.logger.warn(
						`Failed to load song "${song.title}" from playlist "${name}": ${error}`,
					);
					// Continue loading other songs even if one fails
				}
			}

			this.logger.log(
				`User ${interaction.user.username} (${userId}) loaded playlist "${name}" with ${playlist.songs.length} songs`,
			);
		} catch (error) {
			this.logger.error(`Failed to load playlist: ${error}`);
			const errorEmbed = EmbedBuilderUtils.createErrorEmbed(
				'Failed to load playlist. Please try again.',
			);
			await interaction.editReply({ embeds: [errorEmbed] });
		}
	}

	@Subcommand({
		name: 'list',
		description: 'Show your saved playlists',
	})
	public async list(@Context() context: SlashCommandContext) {
		const [interaction] = context;
		if (!interaction.isChatInputCommand()) return;

		await interaction.deferReply({ ephemeral: true });

		try {
			const userId = interaction.user.id;
			const username = interaction.user.username;

			// Get user's playlists
			const playlists =
				await this.playlistStorageService.getUserPlaylists(userId);

			// Format playlists for embed
			const formattedPlaylists = playlists.map((playlist) => ({
				name: playlist.name,
				songCount: playlist.songs.length,
				updatedAt: playlist.updatedAt,
			}));

			// Create and send embed
			const embed = EmbedBuilderUtils.createPlaylistListEmbed(
				formattedPlaylists,
				username,
			);
			await interaction.editReply({ embeds: [embed] });

			this.logger.log(
				`User ${username} (${userId}) viewed their playlists (${playlists.length} total)`,
			);
		} catch (error) {
			this.logger.error(`Failed to list playlists: ${error}`);
			const errorEmbed = EmbedBuilderUtils.createErrorEmbed(
				'Failed to load playlists. Please try again.',
			);
			await interaction.editReply({ embeds: [errorEmbed] });
		}
	}

	@Subcommand({
		name: 'delete',
		description: 'Delete a saved playlist',
	})
	public async delete(
		@Context() context: SlashCommandContext,
		@Options() { name }: PlaylistDeleteDto,
	) {
		const [interaction] = context;
		if (!interaction.isChatInputCommand()) return;

		await interaction.deferReply({ ephemeral: true });

		try {
			const userId = interaction.user.id;
			const username = interaction.user.username;

			// Delete playlist from database
			const deleted = await this.playlistStorageService.deletePlaylist(
				userId,
				name,
			);

			if (!deleted) {
				const errorEmbed = EmbedBuilderUtils.createErrorEmbed(
					`Playlist **${name}** not found. Use \`/playlist list\` to see your playlists.`,
				);
				await interaction.editReply({ embeds: [errorEmbed] });
				return;
			}

			// Send success embed
			const embed = EmbedBuilderUtils.createPlaylistDeletedEmbed(name);
			await interaction.editReply({ embeds: [embed] });

			this.logger.log(
				`User ${username} (${userId}) deleted playlist "${name}"`,
			);
		} catch (error) {
			this.logger.error(`Failed to delete playlist: ${error}`);
			const errorEmbed = EmbedBuilderUtils.createErrorEmbed(
				'Failed to delete playlist. Please try again.',
			);
			await interaction.editReply({ embeds: [errorEmbed] });
		}
	}
}
