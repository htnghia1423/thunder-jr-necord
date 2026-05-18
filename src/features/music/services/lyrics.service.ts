import { Injectable, Logger } from '@nestjs/common';

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
 * Shape of a successful LRCLIB /api/get or /api/search response object
 */
interface LrclibTrack {
	id: number;
	trackName: string;
	artistName: string;
	albumName: string | null;
	duration: number;
	plainLyrics: string | null;
	syncedLyrics: string | null;
}

interface SongMetadata {
	trackName: string;
	artistName?: string;
	searchQueries: string[];
}

/**
 * LyricsService fetches song lyrics from LRCLIB (https://lrclib.net)
 * — a developer-friendly, Cloudflare-free REST API requiring no API key.
 *
 * Strategy:
 *  1. If query contains " - ", split into artist + track and call /api/get directly.
 *  2. Otherwise (or on 404 from step 1), fall back to /api/search and pick the first result.
 */
@Injectable()
export class LyricsService {
	private readonly logger = new Logger(LyricsService.name);
	private readonly MAX_CHUNK_LENGTH = 3000;
	private readonly BASE_URL = 'https://lrclib.net/api';

	constructor() {
		this.logger.log('LyricsService initialized — using LRCLIB REST API');
	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/**
	 * Get lyrics for a song by search query.
	 * @param query - "Artist - Song" or plain song title
	 * @returns Lyrics result with title, artist, and formatted lyrics
	 * @throws Error if song not found, lyrics unavailable, or network fails
	 */
	async getLyrics(query: string): Promise<LyricsResult> {
		const cleanedQuery = this.cleanSongTitle(query);
		this.logger.log(
			`Searching for lyrics: "${cleanedQuery}" (original: "${query}")`,
		);

		// Strategy 1: If "Artist - Title" format, try the direct /api/get endpoint first
		const dashIndex = cleanedQuery.indexOf(' - ');
		if (dashIndex !== -1) {
			const artistName = cleanedQuery.slice(0, dashIndex).trim();
			const trackName = cleanedQuery.slice(dashIndex + 3).trim();

			const track = await this.fetchByArtistAndTrack(artistName, trackName);
			if (track) {
				return this.buildResult(track);
			}

			this.logger.log(
				`Direct lookup returned no result for "${artistName} - ${trackName}", falling back to search`,
			);
		}

		// Strategy 2: Full-text search endpoint
		return this.fetchBySearch(cleanedQuery, query);
	}

	/**
	 * Get lyrics for a queued song by using both title and artist/uploader metadata.
	 * This avoids ambiguous matches when multiple songs share the same title.
	 */
	async getLyricsForSong(
		title: string,
		artistName?: string,
	): Promise<LyricsResult> {
		const {
			trackName,
			artistName: resolvedArtistName,
			searchQueries,
		} = this.resolveSongMetadata(title, artistName);

		if (resolvedArtistName) {
			this.logger.log(
				`Searching for lyrics by metadata: "${resolvedArtistName} - ${trackName}"`,
			);

			const track = await this.fetchByArtistAndTrack(
				resolvedArtistName,
				trackName,
			);

			if (track) {
				return this.buildResult(track);
			}

			this.logger.log(
				`Direct metadata lookup returned no result for "${resolvedArtistName} - ${trackName}", falling back to search`,
			);
		}

		return this.fetchBySearchCandidates(searchQueries, title);
	}

	/**
	 * Split lyrics into chunks that fit within Discord embed limits.
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
			const potentialChunk = currentChunk + (currentChunk ? '\n' : '') + line;

			if (potentialChunk.length > maxLength) {
				if (currentChunk) {
					chunks.push(currentChunk);
					currentChunk = line;
				} else {
					// Single line longer than maxLength — force add it
					chunks.push(line);
				}
			} else {
				currentChunk = potentialChunk;
			}
		}

		if (currentChunk) {
			chunks.push(currentChunk);
		}

		// Guarantee at least one chunk
		if (chunks.length === 0) {
			chunks.push(lyrics.substring(0, maxLength));
		}

		this.logger.log(`Split lyrics into ${chunks.length} chunk(s)`);
		return chunks;
	}

	// ---------------------------------------------------------------------------
	// Private — HTTP helpers
	// ---------------------------------------------------------------------------

	/**
	 * Call LRCLIB /api/get with explicit artist + track names.
	 * Returns null on 404 (not found); throws on other HTTP errors.
	 */
	private async fetchByArtistAndTrack(
		artistName: string,
		trackName: string,
	): Promise<LrclibTrack | null> {
		const url = new URL(`${this.BASE_URL}/get`);
		url.searchParams.set('artist_name', artistName);
		url.searchParams.set('track_name', trackName);

		this.logger.debug(`LRCLIB GET: ${url.toString()}`);

		const response = await this.request(url.toString());

		if (response.status === 404) {
			return null;
		}

		this.assertOk(response, url.toString());
		return response.json() as Promise<LrclibTrack>;
	}

	/**
	 * Call LRCLIB /api/search with a free-text query.
	 * Picks the first result and returns a full LyricsResult.
	 * Throws if nothing is found or lyrics are empty.
	 */
	private async fetchBySearch(
		cleanedQuery: string,
		originalQuery: string,
	): Promise<LyricsResult> {
		const url = new URL(`${this.BASE_URL}/search`);
		url.searchParams.set('q', cleanedQuery);

		this.logger.debug(`LRCLIB SEARCH: ${url.toString()}`);

		const response = await this.request(url.toString());
		this.assertOk(response, url.toString());

		const results = (await response.json()) as LrclibTrack[];

		if (!Array.isArray(results) || results.length === 0) {
			this.logger.warn(`No results found for query: "${cleanedQuery}"`);
			throw new Error(
				`No results found for "${originalQuery}". Try using a different search term or check the spelling.`,
			);
		}

		// Pick first result — LRCLIB returns results ordered by relevance
		return this.buildResult(results[0]);
	}

	/**
	 * Try multiple cleaned search candidates before reporting no lyrics.
	 */
	private async fetchBySearchCandidates(
		queries: string[],
		originalQuery: string,
	): Promise<LyricsResult> {
		let lastError: Error | undefined;

		for (const query of queries) {
			try {
				return await this.fetchBySearch(query, originalQuery);
			} catch (error) {
				if (error instanceof Error) {
					lastError = error;

					if (!error.message.includes('No results found')) {
						throw error;
					}
				}
			}
		}

		throw (
			lastError ||
			new Error(
				`No results found for "${originalQuery}". Try using a different search term or check the spelling.`,
			)
		);
	}

	/**
	 * Thin wrapper around native fetch that sets common headers
	 * and converts network errors into a friendlier Error.
	 */
	private async request(url: string): Promise<Response> {
		try {
			return await fetch(url, {
				headers: {
					Accept: 'application/json',
					'User-Agent': 'ThunderJrBot/1.0 (Discord music bot)',
				},
			});
		} catch (error) {
			this.logger.error(`Network error reaching LRCLIB: ${url}`, error);
			throw new Error('Failed to fetch lyrics. Please try again later.');
		}
	}

	/**
	 * Throw a descriptive error for any non-2xx response (excluding 404
	 * which is handled by the callers explicitly).
	 */
	private assertOk(response: Response, url: string): void {
		if (!response.ok) {
			this.logger.error(`LRCLIB returned HTTP ${response.status} for: ${url}`);
			throw new Error(
				`Failed to fetch lyrics (HTTP ${response.status}). Please try again later.`,
			);
		}
	}

	// ---------------------------------------------------------------------------
	// Private — Data helpers
	// ---------------------------------------------------------------------------

	/**
	 * Convert a raw LRCLIB track into a LyricsResult, validating that lyrics exist.
	 */
	private buildResult(track: LrclibTrack): LyricsResult {
		if (track.syncedLyrics) {
			this.logger.log(
				`Synced lyrics available for "${track.trackName}" — using plainLyrics for embed`,
			);
		}

		if (!track.plainLyrics) {
			this.logger.warn(`Lyrics not available for: "${track.trackName}"`);
			throw new Error(`Lyrics not available for "${track.trackName}".`);
		}

		this.logger.log(
			`Successfully fetched lyrics for: "${track.trackName}" by ${track.artistName}`,
		);

		return {
			title: track.trackName,
			artist: track.artistName,
			lyrics: this.formatLyrics(track.plainLyrics),
			// LRCLIB does not provide artwork; thumbnail is intentionally omitted
		};
	}

	/**
	 * Clean song title by removing common YouTube/DisTube clutter.
	 */
	private cleanSongTitle(title: string): string {
		let cleaned = title;

		// Remove leading roleplay/alias blocks often used in YouTube titles.
		cleaned = cleaned.replaceAll(/^\s*\|[^|]+\|\s*/g, '');

		// Remove producer credits and everything after them.
		cleaned = cleaned.replaceAll(
			/\s+(?:prod\.?|produced by|beat by)\s+.*$/gi,
			'',
		);

		// Remove common video quality indicators
		cleaned = cleaned.replaceAll(
			/\((?:HD|4K|HQ|Official|Official Audio|Official Video|Audio|Video|Lyric(?:s)?|Music Video|MV)\)/gi,
			'',
		);
		cleaned = cleaned.replaceAll(
			/\[(?:HD|4K|HQ|Official|Official Audio|Official Video|Audio|Video|Lyric(?:s)?|Music Video|MV)\]/gi,
			'',
		);

		// Remove featuring artists in parentheses/brackets
		cleaned = cleaned.replaceAll(/\((?:ft\.|feat\.|featuring).*?\)/gi, '');
		cleaned = cleaned.replaceAll(/\[(?:ft\.|feat\.|featuring).*?\]/gi, '');

		// Normalize separators that LRCLIB search handles better as plain spaces.
		cleaned = cleaned.replaceAll(/[|"'`]/g, ' ');

		// Collapse extra whitespace
		cleaned = cleaned.replaceAll(/\s+/g, ' ').trim();

		return cleaned;
	}

	/**
	 * Resolve usable LRCLIB metadata from a DisTube title and optional uploader.
	 */
	private resolveSongMetadata(
		title: string,
		artistName?: string,
	): SongMetadata {
		const cleanedTitle = this.cleanSongTitle(title);
		const cleanedArtistName = artistName
			? this.cleanArtistName(artistName)
			: undefined;
		const pipeArtistName = this.extractLeadingPipeArtist(title);

		const dashIndex = cleanedTitle.indexOf(' - ');
		if (dashIndex !== -1) {
			const titleArtistName = cleanedTitle.slice(0, dashIndex).trim();
			const trackName = cleanedTitle.slice(dashIndex + 3).trim();
			const resolvedArtistName =
				cleanedArtistName || pipeArtistName || titleArtistName;

			return {
				trackName,
				artistName: resolvedArtistName,
				searchQueries: this.buildSearchCandidates(
					trackName,
					resolvedArtistName,
					cleanedTitle,
				),
			};
		}

		const resolvedArtistName = cleanedArtistName || pipeArtistName;

		return {
			trackName: cleanedTitle,
			artistName: resolvedArtistName,
			searchQueries: this.buildSearchCandidates(
				cleanedTitle,
				resolvedArtistName,
				this.cleanSongTitleWithoutRemovingPipeBlocks(title),
			),
		};
	}

	/**
	 * Clean uploader/artist names from common YouTube channel suffixes.
	 */
	private cleanArtistName(artistName: string): string {
		return artistName
			.replaceAll(/\s*\/\/.*$/g, '')
			.replaceAll(/\s*-\s*Topic$/gi, '')
			.replaceAll(/\s*VEVO$/gi, '')
			.replaceAll(/\s+Official$/gi, '')
			.replaceAll(/\s+Official\s+Channel$/gi, '')
			.replaceAll(/\s+/g, ' ')
			.trim();
	}

	/**
	 * Extract artist names wrapped in a leading pipe block, e.g. "|Artist| Track".
	 */
	private extractLeadingPipeArtist(title: string): string | undefined {
		const match = title.match(/^\s*\|([^|]+)\|/);
		if (!match?.[1]) {
			return undefined;
		}

		return this.cleanArtistName(match[1]);
	}

	/**
	 * Keep a less aggressive title variant as a last-resort full-text search.
	 */
	private cleanSongTitleWithoutRemovingPipeBlocks(title: string): string {
		return title
			.replaceAll(/\s+(?:prod\.?|produced by|beat by)\s+.*$/gi, '')
			.replaceAll(/[|"'`]/g, ' ')
			.replaceAll(/\s+/g, ' ')
			.trim();
	}

	/**
	 * Build ordered LRCLIB search fallbacks from most specific to broadest.
	 */
	private buildSearchCandidates(
		trackName: string,
		artistName?: string,
		originalTitle?: string,
	): string[] {
		const candidates = [
			artistName ? `${artistName} ${trackName}` : undefined,
			trackName,
			this.expandCompactVietnameseTitle(trackName),
			originalTitle,
		];

		return [...new Set(candidates.filter(Boolean) as string[])];
	}

	/**
	 * Add a readable variant for compact Vietnamese titles often used in uploads.
	 */
	private expandCompactVietnameseTitle(title: string): string {
		const compactTitle = title.toUpperCase();

		if (compactTitle === 'NGONGIODEMQUATRANGSANGDEMNAY') {
			return 'NGON GIO DEM QUA TRANG SANG DEM NAY';
		}

		return title;
	}

	/**
	 * Format lyrics by making section headers bold for Discord rendering.
	 */
	private formatLyrics(lyrics: string): string {
		return lyrics.replaceAll(/\[(.*?)\]/g, '**[$1]**');
	}
}
