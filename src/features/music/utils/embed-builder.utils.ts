import { ExtendedSong } from '../interfaces/distube-types.interface';
import { MusicConstants } from '../music.constants';
import { EmbedBuilder } from 'discord.js';

/**
 * Queue-like interface that works with both Queue and ExtendedQueue
 */
interface QueueLike {
	songs: ExtendedSong[];
	currentTime?: number;
	formattedCurrentTime?: string;
	formattedDuration?: string;
	repeatMode?: number;
	volume?: number;
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
}
