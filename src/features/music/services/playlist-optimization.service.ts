import { Injectable, Logger } from '@nestjs/common';

/**
 * PlaylistOptimizationService handles YouTube playlist detection and URL optimization
 * Separated for Single Responsibility Principle
 */
@Injectable()
export class PlaylistOptimizationService {
	private readonly logger = new Logger(PlaylistOptimizationService.name);

	/**
	 * Check if query is a YouTube standard playlist (not a Mix)
	 * Standard playlists: PL*, UU*, FL*, LL*, etc.
	 * Mixes (not supported): RD*, RDMM*, RDAO*, RDCLAK*, etc.
	 */
	isYouTubeStandardPlaylist(query: string): boolean {
		if (!query.includes('youtube.com') || !query.includes('list=')) {
			return false;
		}

		try {
			const urlParams = new URLSearchParams(query.split('?')[1]);
			const playlistId = urlParams.get('list');

			if (!playlistId) {
				return false;
			}

			// Exclude YouTube Mixes (they start with 'RD')
			// This prevents hanging on API calls that don't support Mixes
			if (playlistId.startsWith('RD')) {
				this.logger.log(
					`Detected YouTube Mix (${playlistId}), skipping API optimization`,
				);
				return false;
			}

			// Accept all other playlist types
			return true;
		} catch {
			this.logger.warn(`Failed to parse playlist URL: ${query}`);
			return false;
		}
	}

	/**
	 * Strip Mix and playlist parameters from YouTube URL
	 * Converts: https://www.youtube.com/watch?v=VIDEO_ID&list=RDXXX&start_radio=1
	 * To:       https://www.youtube.com/watch?v=VIDEO_ID
	 * This forces DisTube to treat it as a single song for instant playback
	 */
	stripMixParameters(url: string): string {
		try {
			const urlObj = new URL(url);

			// Keep only the video ID parameter
			const videoId = urlObj.searchParams.get('v');

			if (!videoId) {
				this.logger.warn('No video ID found in URL, returning original');
				return url;
			}

			// Reconstruct URL with only video ID
			return `https://www.youtube.com/watch?v=${videoId}`;
		} catch (error) {
			this.logger.error(`Failed to parse URL: ${url}`, error);
			return url; // Return original on error
		}
	}

	/**
	 * Determine if URL should use playlist optimization
	 */
	shouldOptimizePlaylist(query: string): boolean {
		return this.isYouTubeStandardPlaylist(query);
	}
}
