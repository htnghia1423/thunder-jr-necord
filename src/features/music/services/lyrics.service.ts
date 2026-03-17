import { Injectable, Logger } from '@nestjs/common';
import { Client, UnexpectedResponseError } from 'genius-lyrics';

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
 * with advanced title cleaning, formatting, rate limiting, and Cloudflare bypass capabilities
 */
@Injectable()
export class LyricsService {
	private readonly logger = new Logger(LyricsService.name);
	private readonly geniusClient: Client;
	private readonly MAX_CHUNK_LENGTH = 3000;

	// Rate limiting properties
	private lastRequestTime = 0;
	private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

	// Retry configuration
	private readonly MAX_RETRIES = 2;
	private readonly RETRY_DELAY_MS = 2000; // 2 seconds between retries

	constructor() {
		const geniusToken = process.env.GENIUS_ACCESS_TOKEN;

		if (!geniusToken) {
			this.logger.error(
				'GENIUS_ACCESS_TOKEN not found in environment variables',
			);
			throw new Error('GENIUS_ACCESS_TOKEN is required for LyricsService');
		}

		// Initialize Genius Client with browser mimicry headers to bypass Cloudflare
		this.geniusClient = new Client(geniusToken, {
			requestOptions: {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
					Accept:
						'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
					'Accept-Language': 'en-US,en;q=0.9',
					'Accept-Encoding': 'gzip, deflate, br',
					Referer: 'https://www.google.com/',
					'Sec-Fetch-Dest': 'document',
					'Sec-Fetch-Mode': 'navigate',
					'Sec-Fetch-Site': 'cross-site',
					'Sec-Fetch-User': '?1',
					'Upgrade-Insecure-Requests': '1',
					'Cache-Control': 'max-age=0',
				},
			},
		});

		this.logger.log(
			'LyricsService initialized with Genius API client and browser mimicry headers',
		);
	}

	/**
	 * Get lyrics for a song by search query
	 * @param query - Song name or "Artist - Song" format
	 * @returns Lyrics result with title, artist, lyrics, and thumbnail
	 * @throws Error if song not found or API fails
	 */
	async getLyrics(query: string): Promise<LyricsResult> {
		// Enforce rate limiting before making request
		await this.enforceRateLimit();

		// Clean the query for better search results
		const cleanedQuery = this.cleanSongTitle(query);
		this.logger.log(
			`Searching for lyrics: "${cleanedQuery}" (original: "${query}")`,
		);

		// Use retry logic to handle transient Cloudflare blocks
		return this.fetchWithRetry(async () => {
			try {
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
				// Handle specific error types
				if (error instanceof UnexpectedResponseError) {
					const statusCode = error.error.statusCode;

					if (statusCode === 403) {
						this.logger.warn(
							`Cloudflare blocked lyrics scraping for: "${query}". Status: 403 Forbidden. Browser mimicry may have failed.`,
						);
						throw new Error(
							`Lyrics temporarily unavailable for "${query}" due to rate limiting. Please try again in a few moments or search for a different song.`,
						);
					}

					this.logger.error(
						`Unexpected HTTP ${statusCode} response for query: "${query}"`,
						error,
					);
					throw new Error(
						`Failed to fetch lyrics (HTTP ${statusCode}). Please try again later.`,
					);
				}

				if (error instanceof Error) {
					// Re-throw our custom errors
					if (
						error.message.includes('No results found') ||
						error.message.includes('not available')
					) {
						throw error;
					}
				}

				this.logger.error(
					`Failed to fetch lyrics for query: "${query}"`,
					error,
				);
				throw new Error('Failed to fetch lyrics. Please try again later.');
			}
		});
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
	 * Enforce rate limiting to prevent triggering Cloudflare protection
	 * Ensures minimum interval between requests
	 */
	private async enforceRateLimit(): Promise<void> {
		const now = Date.now();
		const timeSinceLastRequest = now - this.lastRequestTime;

		if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
			const delay = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
			this.logger.debug(
				`Rate limiting: waiting ${delay}ms before next request`,
			);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}

		this.lastRequestTime = Date.now();
	}

	/**
	 * Fetch lyrics with retry logic for transient Cloudflare 403 blocks
	 * @param operation - Async operation to execute with retry
	 * @returns Result of the operation
	 * @throws Error if all retries are exhausted
	 */
	private async fetchWithRetry<T>(operation: () => Promise<T>): Promise<T> {
		for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
			try {
				return await operation();
			} catch (error) {
				// Only retry on 403 Cloudflare blocks
				if (
					error instanceof UnexpectedResponseError &&
					error.error.statusCode === 403
				) {
					if (attempt < this.MAX_RETRIES) {
						this.logger.warn(
							`403 Forbidden detected, retrying (${attempt}/${this.MAX_RETRIES})...`,
						);
						await new Promise((resolve) =>
							setTimeout(resolve, this.RETRY_DELAY_MS),
						);
						continue;
					}
				}

				// For non-403 errors or last retry attempt, throw immediately
				throw error;
			}
		}

		// This should never be reached, but TypeScript needs it
		throw new Error('Max retries exceeded');
	}

	/**
	 * Clean song title by removing common YouTube/DisTube clutter
	 * @param title - Raw song title from DisTube/YouTube
	 * @returns Cleaned title for better search results
	 */
	private cleanSongTitle(title: string): string {
		let cleaned = title;

		// Remove common video quality indicators
		cleaned = cleaned.replaceAll(
			/\((?:HD|4K|HQ|Official|Audio|Video|Lyric(?:s)?|Music Video|MV)\)/gi,
			'',
		);
		cleaned = cleaned.replaceAll(
			/\[(?:HD|4K|HQ|Official|Audio|Video|Lyric(?:s)?|Music Video|MV)\]/gi,
			'',
		);

		// Remove featuring artists in parentheses/brackets
		cleaned = cleaned.replaceAll(/\((?:ft\.|feat\.|featuring).*?\)/gi, '');
		cleaned = cleaned.replaceAll(/\[(?:ft\.|feat\.|featuring).*?\]/gi, '');

		// Remove extra whitespace and trim
		cleaned = cleaned.replaceAll(/\s+/g, ' ').trim();

		return cleaned;
	}

	/**
	 * Format lyrics by making section headers bold
	 * @param lyrics - Raw lyrics text
	 * @returns Formatted lyrics with bold headers
	 */
	private formatLyrics(lyrics: string): string {
		// Find and bold section headers like [Chorus], [Verse 1], [Bridge], etc.
		return lyrics.replaceAll(/\[(.*?)\]/g, '**[$1]**');
	}
}
