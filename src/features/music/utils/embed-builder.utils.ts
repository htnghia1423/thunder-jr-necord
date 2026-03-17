import type { ServerStatsData, UserStatsData } from '../dto/stats.dto';
import { ExtendedSong } from '../interfaces/distube-types.interface';
import { MusicConstants } from '../music.constants';
import { EmbedBuilder } from 'discord.js';

/**
 * Queue-like interface that works with both Queue and ExtendedQueue
 */
export interface QueueLike {
	songs: ExtendedSong[];
	currentTime?: number;
	formattedCurrentTime?: string;
	formattedDuration?: string;
	repeatMode?: number;
	volume?: number;
	paused?: boolean;
	previousSongs?: ExtendedSong[] | any[];
}

/**
 * Static utility class for creating consistent Discord embeds for music bot responses
 */
export class EmbedBuilderUtils {
	private static readonly SONGS_PER_PAGE = 10;

	/**
	 * Create an embed for when a song is added to the queue or starts playing
	 * @param song - The song that was added
	 * @param position - Position in queue (1-indexed), or undefined if now playing
	 * @returns EmbedBuilder configured for play response
	 */
	static createPlayEmbed(song: ExtendedSong, position?: number): EmbedBuilder {
		const isNowPlaying = !position || position === 1;
		const embed = new EmbedBuilder()
			.setColor(MusicConstants.COLOR_SUCCESS)
			.setTitle(isNowPlaying ? '🎵 Now Playing' : '🎵 Added to Queue')
			.setDescription(`[${song.name || 'Unknown Song'}](${song.url || ''})`)
			.setTimestamp();

		// Add thumbnail if available
		if (song.thumbnail) {
			embed.setThumbnail(song.thumbnail);
		}

		// Add uploader field
		embed.addFields({
			name: '👤 Uploader',
			value: song.uploader?.name || MusicConstants.DEFAULT_UPLOADER_NAME,
			inline: true,
		});

		// Add duration field
		embed.addFields({
			name: '⏱️ Duration',
			value: song.formattedDuration || '00:00',
			inline: true,
		});

		// Add position field only if not currently playing
		if (position && position > 1) {
			embed.addFields({
				name: '📍 Position',
				value: `#${position}`,
				inline: true,
			});
		}

		// Add footer with requester info
		if (song.user) {
			embed.setFooter({
				text: `Requested by ${song.user.username}`,
				iconURL: song.user.displayAvatarURL(),
			});
		}

		return embed;
	}

	/**
	 * Create an embed showing currently playing song with progress
	 * @param queue - The DisTube queue
	 * @returns EmbedBuilder configured for now playing display
	 */
	static createNowPlayingEmbed(queue: QueueLike): EmbedBuilder {
		const currentSong = queue.songs[0];
		if (!currentSong) {
			return this.createErrorEmbed('No song is currently playing');
		}

		const embed = new EmbedBuilder()
			.setColor(MusicConstants.COLOR_INFO)
			.setTitle('🎶 Now Playing')
			.setDescription(
				`[${currentSong.name || 'Unknown Song'}](${currentSong.url || ''})`,
			)
			.setTimestamp();

		// Add thumbnail if available
		if (currentSong.thumbnail) {
			embed.setThumbnail(currentSong.thumbnail);
		}

		// Add uploader field
		embed.addFields({
			name: '👤 Uploader',
			value: currentSong.uploader?.name || MusicConstants.DEFAULT_UPLOADER_NAME,
			inline: true,
		});

		// Add duration with current time
		const currentTime = queue.formattedCurrentTime || '00:00';
		const totalDuration = currentSong.formattedDuration || '00:00';
		embed.addFields({
			name: '⏱️ Duration',
			value: `${currentTime} / ${totalDuration}`,
			inline: true,
		});

		// Add loop mode
		let loopModeText = 'Off';
		if (queue.repeatMode === 2) {
			loopModeText = 'Queue';
		} else if (queue.repeatMode === 1) {
			loopModeText = 'Song';
		}
		embed.addFields({
			name: '🔁 Loop Mode',
			value: loopModeText,
			inline: true,
		});

		// Add volume
		embed.addFields({
			name: '🔊 Volume',
			value: `${queue.volume}%`,
			inline: true,
		});

		// Add progress bar
		const progressBar = this.createProgressBar(
			queue.currentTime || 0,
			currentSong.duration,
		);
		embed.addFields({
			name: '📊 Progress',
			value: progressBar,
			inline: false,
		});

		// Add footer with requester info
		if (currentSong.user) {
			embed.setFooter({
				text: `Requested by ${currentSong.user.username}`,
				iconURL: currentSong.user.displayAvatarURL(),
			});
		}

		return embed;
	}

	/**
	 * Create an embed displaying the music queue with pagination
	 * @param queue - The DisTube queue
	 * @param page - Current page number (1-indexed)
	 * @param totalPages - Total number of pages
	 * @returns EmbedBuilder configured for queue display
	 */
	static createQueueEmbed(
		queue: QueueLike,
		page: number,
		totalPages: number,
	): EmbedBuilder {
		const embed = new EmbedBuilder()
			.setColor(MusicConstants.COLOR_QUEUE)
			.setTitle(`🎵 Music Queue - Page ${page}/${totalPages}`)
			.setTimestamp();

		// Build description
		let description = '';

		// Current song (index 0)
		const currentSong = queue.songs[0];
		if (currentSong) {
			const requester = currentSong.user
				? `<@${currentSong.user.id}>`
				: 'Unknown';
			description += `**Now Playing:**\n[${currentSong.name || 'Unknown'}](${currentSong.url || ''}) - \`${currentSong.formattedDuration || '00:00'}\` - Requested by ${requester}\n\n`;
		}

		// Upcoming songs (indices 1+)
		if (queue.songs.length > 1) {
			description += '**Up Next:**\n';

			// Calculate pagination indices
			const startIndex = (page - 1) * this.SONGS_PER_PAGE + 1; // +1 to skip current song
			const endIndex = Math.min(
				page * this.SONGS_PER_PAGE + 1,
				queue.songs.length,
			);

			// Show songs for current page
			for (let i = startIndex; i < endIndex; i++) {
				const song = queue.songs[i];
				const requester = song.user ? `<@${song.user.id}>` : 'Unknown';
				description += `${i}. [${song.name || 'Unknown'}](${song.url || ''}) - \`${song.formattedDuration || '00:00'}\` - Requested by ${requester}\n`;
			}
		} else {
			description += '\n*No songs in queue*';
		}

		embed.setDescription(description);

		// Add queue info field
		const queueLength = queue.songs.length;
		const totalDuration = queue.formattedDuration || '00:00';
		embed.addFields({
			name: '📊 Queue Info',
			value: `${queueLength} song${queueLength === 1 ? '' : 's'} | Total Duration: ${totalDuration}`,
			inline: false,
		});

		// Add loop mode
		let loopModeText = 'Off';
		if (queue.repeatMode === 2) {
			loopModeText = 'Queue';
		} else if (queue.repeatMode === 1) {
			loopModeText = 'Song';
		}
		embed.addFields({
			name: '🔁 Loop',
			value: loopModeText,
			inline: true,
		});

		// Add volume
		embed.addFields({
			name: '🔊 Volume',
			value: `${queue.volume}%`,
			inline: true,
		});

		// Set footer
		embed.setFooter({
			text: `Page ${page} of ${totalPages} | Use buttons to navigate`,
		});

		return embed;
	}

	/**
	 * Create an error embed
	 * @param errorMessage - The error message to display
	 * @returns EmbedBuilder configured for error display
	 */
	static createErrorEmbed(errorMessage: string): EmbedBuilder {
		return new EmbedBuilder()
			.setColor(MusicConstants.COLOR_ERROR)
			.setTitle('❌ Error')
			.setDescription(errorMessage)
			.setTimestamp();
	}

	/**
	 * Create a text-based progress bar
	 * @param current - Current time in seconds
	 * @param total - Total time in seconds
	 * @param length - Length of progress bar in characters (default: 20)
	 * @returns Formatted progress bar string
	 */
	static createProgressBar(
		current: number,
		total: number,
		length: number = MusicConstants.PROGRESS_BAR_LENGTH,
	): string {
		// Handle edge cases
		if (!total || total <= 0 || !current || current < 0) {
			return `[${MusicConstants.PROGRESS_BAR_EMPTY_CHAR.repeat(length)}] ${MusicConstants.DEFAULT_PROGRESS_PERCENTAGE}%`;
		}

		// Calculate percentage and filled characters
		const percentage = Math.min((current / total) * 100, 100);
		const filled = Math.floor((current / total) * length);
		const empty = length - filled;

		// Build progress bar
		const progressBar = `[${MusicConstants.PROGRESS_BAR_FILLED_CHAR.repeat(filled)}${MusicConstants.PROGRESS_BAR_EMPTY_CHAR.repeat(empty)}]`;
		return `${progressBar} ${Math.floor(percentage)}%`;
	}

	/**
	 * Create an embed for when a playlist is successfully saved
	 * @param playlistName - Name of the saved playlist
	 * @param songCount - Number of songs in the playlist
	 * @param username - Name of the user who saved the playlist
	 * @returns EmbedBuilder configured for playlist save confirmation
	 */
	static createPlaylistSavedEmbed(
		playlistName: string,
		songCount: number,
		username: string,
	): EmbedBuilder {
		return new EmbedBuilder()
			.setColor(MusicConstants.COLOR_SUCCESS)
			.setTitle('💾 Playlist Saved')
			.setDescription(
				`Your playlist **${playlistName}** has been saved successfully!`,
			)
			.addFields(
				{
					name: '🎵 Songs',
					value: `${songCount} song${songCount === 1 ? '' : 's'}`,
					inline: true,
				},
				{
					name: '👤 Owner',
					value: username,
					inline: true,
				},
			)
			.setFooter({ text: `Use /playlist load ${playlistName} to load it` })
			.setTimestamp();
	}

	/**
	 * Create an embed for when a playlist is successfully loaded
	 * @param playlistName - Name of the loaded playlist
	 * @param songCount - Number of songs in the playlist
	 * @returns EmbedBuilder configured for playlist load confirmation
	 */
	static createPlaylistLoadedEmbed(
		playlistName: string,
		songCount: number,
	): EmbedBuilder {
		return new EmbedBuilder()
			.setColor(MusicConstants.COLOR_SUCCESS)
			.setTitle('📂 Playlist Loaded')
			.setDescription(
				`Loading **${playlistName}** with ${songCount} song${songCount === 1 ? '' : 's'}...`,
			)
			.setTimestamp();
	}

	/**
	 * Create an embed displaying user's saved playlists
	 * @param playlists - Array of playlist objects with name, song count, and updated date
	 * @param username - Name of the user
	 * @returns EmbedBuilder configured for playlist list display
	 */
	static createPlaylistListEmbed(
		playlists: Array<{
			name: string;
			songCount: number;
			updatedAt: Date;
		}>,
		username: string,
	): EmbedBuilder {
		const embed = new EmbedBuilder()
			.setColor(MusicConstants.COLOR_INFO)
			.setTitle(`📚 ${username}'s Playlists`)
			.setTimestamp();

		if (playlists.length === 0) {
			embed.setDescription(
				'You have no saved playlists yet.\nUse `/playlist save <name>` to save your current queue!',
			);
			return embed;
		}

		// Build description with all playlists
		let description = '';
		playlists.forEach((playlist, index) => {
			const updatedDate = new Date(playlist.updatedAt).toLocaleDateString();
			description += `${index + 1}. **${playlist.name}**\n`;
			description += `   └ ${playlist.songCount} song${playlist.songCount === 1 ? '' : 's'} • Last updated: ${updatedDate}\n\n`;
		});

		embed.setDescription(description);
		embed.setFooter({
			text: `${playlists.length} playlist${playlists.length === 1 ? '' : 's'} total`,
		});

		return embed;
	}

	/**
	 * Create an embed for when a playlist is successfully deleted
	 * @param playlistName - Name of the deleted playlist
	 * @returns EmbedBuilder configured for playlist delete confirmation
	 */
	static createPlaylistDeletedEmbed(playlistName: string): EmbedBuilder {
		return new EmbedBuilder()
			.setColor(MusicConstants.COLOR_SUCCESS)
			.setTitle('🗑️ Playlist Deleted')
			.setDescription(
				`Playlist **${playlistName}** has been deleted successfully.`,
			)
			.setTimestamp();
	}

	/**
	 * Create an embed displaying server-wide music statistics
	 * @param stats - Server statistics data with top songs and DJs
	 * @returns EmbedBuilder configured for server stats display
	 */
	static createServerStatsEmbed(stats: ServerStatsData): EmbedBuilder {
		const embed = new EmbedBuilder()
			.setColor(MusicConstants.COLOR_INFO)
			.setTitle('📊 Server Music Statistics')
			.setTimestamp();

		// Add total plays field
		embed.addFields({
			name: '🎵 Total Plays',
			value: `${stats.totalPlays.toLocaleString()} song${stats.totalPlays === 1 ? '' : 's'} played`,
			inline: false,
		});

		// Add top songs field
		this.addTopSongsField(embed, stats.topSongs, ' Top Songs');

		// Add top DJs field
		if (stats.topDJs.length > 0) {
			let topDJsText = '';
			const medals = ['🥇', '🥈', '🥉'];
			stats.topDJs.forEach((dj, index) => {
				const medal = medals[index] ?? '🎧';
				topDJsText += `${medal} **${index + 1}.** ${dj.username} — ${dj.playCount} play${dj.playCount === 1 ? '' : 's'}\n`;
			});

			embed.addFields({
				name: '🎧 Top DJs',
				value: topDJsText || 'No data available',
				inline: false,
			});
		}

		embed.setFooter({
			text: 'Keep listening to climb the ranks!',
		});

		return embed;
	}

	/**
	 * Create an embed displaying user-specific music statistics
	 * @param stats - User statistics data with personal top songs and rank
	 * @param username - Discord username of the user
	 * @returns EmbedBuilder configured for user stats display
	 */
	static createUserStatsEmbed(
		stats: UserStatsData,
		username: string,
	): EmbedBuilder {
		const embed = new EmbedBuilder()
			.setColor(MusicConstants.COLOR_INFO)
			.setTitle(`📊 ${username}'s Music Statistics`)
			.setTimestamp();

		// Add total plays and rank fields
		embed.addFields(
			{
				name: '🎵 Total Plays',
				value: `${stats.totalPlays.toLocaleString()} song${stats.totalPlays === 1 ? '' : 's'}`,
				inline: true,
			},
			{
				name: '🏆 Server Rank',
				value: stats.rank ? `#${stats.rank}` : 'N/A',
				inline: true,
			},
		);

		// Add top songs field
		this.addTopSongsField(embed, stats.topSongs, '🎶 Your Top Songs');

		embed.setFooter({
			text: 'Keep discovering new music!',
		});

		return embed;
	}

	/**
	 * Helper method to add the top songs field to an embed
	 * @param embed - The EmbedBuilder instance
	 * @param topSongs - Array of top songs
	 * @param fieldTitle - Title for the field
	 */
	private static addTopSongsField(
		embed: EmbedBuilder,
		topSongs: Array<{ songTitle: string; songUrl: string; playCount: number }>,
		fieldTitle: string,
	): void {
		if (topSongs.length > 0) {
			let topSongsText = '';
			const medals = ['🥇', '🥈', '🥉'];
			topSongs.forEach((song, index) => {
				const medal = medals[index] ?? '🎵';
				topSongsText += `${medal} **${index + 1}.** [${song.songTitle}](${song.songUrl}) — ${song.playCount} play${song.playCount === 1 ? '' : 's'}\n`;
			});

			embed.addFields({
				name: fieldTitle,
				value: topSongsText || 'No data available',
				inline: false,
			});
		}
	}

	/**
	 * Create an embed displaying song lyrics with pagination support
	 * @param songTitle - Title of the song
	 * @param artist - Artist name
	 * @param lyricsChunk - The lyrics content for the current page
	 * @param thumbnail - Optional song thumbnail/artwork URL
	 * @param currentPage - Current page number (1-indexed)
	 * @param totalPages - Total number of pages
	 * @returns EmbedBuilder configured for lyrics display
	 */
	static createLyricsEmbed(
		songTitle: string,
		artist: string,
		lyricsChunk: string,
		thumbnail?: string,
		currentPage?: number,
		totalPages?: number,
	): EmbedBuilder {
		const embed = new EmbedBuilder()
			.setColor(MusicConstants.COLOR_INFO)
			.setTitle(`🎤 Lyrics: ${songTitle}`)
			.setDescription(lyricsChunk)
			.setTimestamp();

		// Add artist field
		embed.addFields({
			name: '👤 Artist',
			value: artist,
			inline: true,
		});

		// Add thumbnail if available
		if (thumbnail) {
			embed.setThumbnail(thumbnail);
		}

		// Add footer with pagination info and attribution
		let footerText = 'Data provided by Genius';
		if (currentPage && totalPages) {
			footerText = `Page ${currentPage} of ${totalPages} | ${footerText}`;
		}

		embed.setFooter({ text: footerText });

		return embed;
	}
}
