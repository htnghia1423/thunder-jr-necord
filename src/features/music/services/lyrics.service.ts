import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'genius-lyrics';

/**
 * Result interface for lyrics data
 */
export interface LyricsResult {
	title: string;
	artist: string;
	lyrics: string;
	thumbnail?: string;
}

/**
 * LyricsService handles searching and fetching song lyrics from Genius API
 * with advanced title cleaning and formatting capabilities
 */
@Injectable()
export class LyricsService {
	private readonly logger = new Logger(LyricsService.name);
	private readonly geniusClient: Client;
	private readonly MAX_CHUNK_LENGTH = 3000;

	constructor() {
		const geniusToken = process.env.GENIUS_ACCESS_TOKEN;

		if (!geniusToken) {
			this.logger.error(
				'GENIUS_ACCESS_TOKEN not found in environment variables',
			);
			throw new Error('GENIUS_ACCESS_TOKEN is required for LyricsService');
		}

		this.geniusClient = new Client(geniusToken);
		this.logger.log('LyricsService initialized with Genius API client');
	}

	/**
	 * Get lyrics for a song by search query
	 * @param query - Song name or "Artist - Song" format
	 * @returns Lyrics result with title, artist, lyrics, and thumbnail
	 * @throws Error if song not found or API fails
	 */
	async getLyrics(query: string): Promise<LyricsResult> {
		try {
			// Clean the query for better search results
			const cleanedQuery = this.cleanSongTitle(query);
			this.logger.log(
				`Searching for lyrics: "${cleanedQuery}" (original: "${query}")`,
			);

			// Search for the song using Genius API
			const searches = await this.geniusClient.songs.search(cleanedQuery);

			if (!searches || searches.length === 0) {
				this.logger.warn(`No results found for query: "${cleanedQuery}"`);
				throw new Error(
					`No results found for "${query}". Try using a different search term or check the spelling.`,
				);
			}

			// Get the first (most relevant) result
			const song = searches[0];
			this.logger.log(`Found song: "${song.title}" by ${song.artist.name}`);

			// Fetch the full lyrics
			const lyrics = await song.lyrics();

			if (!lyrics) {
				this.logger.warn(`Lyrics not available for: "${song.title}"`);
				throw new Error(`Lyrics not available for "${song.title}".`);
			}

			// Format lyrics with bold headers
			const formattedLyrics = this.formatLyrics(lyrics);

			this.logger.log(`Successfully fetched lyrics for: "${song.title}"`);

			return {
				title: song.title,
				artist: song.artist.name,
				lyrics: formattedLyrics,
				thumbnail: song.thumbnail,
			};
		} catch (error) {
			if (error instanceof Error) {
				// Re-throw our custom errors
				if (
					error.message.includes('No results found') ||
					error.message.includes('not available')
				) {
					throw error;
				}
			}

			this.logger.error(`Failed to fetch lyrics for query: "${query}"`, error);
			throw new Error('Failed to fetch lyrics. Please try again later.');
		}
	}

	/**
	 * Split lyrics into chunks that fit within Discord embed limits
	 * @param lyrics - Full lyrics text
	 * @param maxLength - Maximum characters per chunk (default: 3000)
	 * @returns Array of lyrics chunks
	 */
	splitLyricsIntoChunks(
		lyrics: string,
		maxLength: number = this.MAX_CHUNK_LENGTH,
	): string[] {
		const lines = lyrics.split('\n');
		const chunks: string[] = [];
		let currentChunk = '';

		for (const line of lines) {
			// Check if adding this line would exceed the limit
			const potentialChunk = currentChunk + (currentChunk ? '\n' : '') + line;

			if (potentialChunk.length > maxLength) {
				// Save current chunk if it has content
				if (currentChunk) {
					chunks.push(currentChunk);
					currentChunk = line;
				} else {
					// Line itself is too long, force add it
					chunks.push(line);
				}
			} else {
				currentChunk = potentialChunk;
			}
		}

		// Add the last chunk if it has content
		if (currentChunk) {
			chunks.push(currentChunk);
		}

		// Ensure we have at least one chunk (even if empty)
		if (chunks.length === 0) {
			chunks.push(lyrics.substring(0, maxLength));
		}

		this.logger.log(`Split lyrics into ${chunks.length} chunk(s)`);
		return chunks;
	}

	/**
	 * Clean song title by removing common YouTube/DisTube clutter
	 * @param title - Raw song title from DisTube/YouTube
	 * @returns Cleaned title for better search results
	 */
	private cleanSongTitle(title: string): string {
		let cleaned = title;

		// Remove common video quality indicators
		cleaned = cleaned.replace(
			/\((?:HD|4K|HQ|Official|Audio|Video|Lyric(?:s)?|Music Video|MV)\)/gi,
			'',
		);
		cleaned = cleaned.replace(
			/\[(?:HD|4K|HQ|Official|Audio|Video|Lyric(?:s)?|Music Video|MV)\]/gi,
			'',
		);

		// Remove featuring artists in parentheses/brackets
		cleaned = cleaned.replace(/\((?:ft\.|feat\.|featuring).*?\)/gi, '');
		cleaned = cleaned.replace(/\[(?:ft\.|feat\.|featuring).*?\]/gi, '');

		// Remove extra whitespace and trim
		cleaned = cleaned.replace(/\s+/g, ' ').trim();

		return cleaned;
	}

	/**
	 * Format lyrics by making section headers bold
	 * @param lyrics - Raw lyrics text
	 * @returns Formatted lyrics with bold headers
	 */
	private formatLyrics(lyrics: string): string {
		// Find and bold section headers like [Chorus], [Verse 1], [Bridge], etc.
		return lyrics.replace(/\[(.*?)\]/g, '**[$1]**');
	}
}
