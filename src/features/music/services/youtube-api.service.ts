import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface PlaylistVideoItem {
	name: string;
	id: string;
	url: string;
	thumbnail?: string;
	uploader?: string;
	duration: number;
}

interface YouTubePlaylistItemSnippet {
	title: string;
	videoOwnerChannelTitle?: string;
	thumbnails?: {
		default?: { url: string };
		medium?: { url: string };
		high?: { url: string };
	};
	resourceId: {
		videoId: string;
	};
}

interface YouTubePlaylistItem {
	snippet: YouTubePlaylistItemSnippet;
}

interface YouTubePlaylistResponse {
	items: YouTubePlaylistItem[];
	nextPageToken?: string;
}

interface YouTubeVideoContentDetails {
	duration: string; // ISO 8601 format
}

interface YouTubeVideoItem {
	id: string;
	contentDetails: YouTubeVideoContentDetails;
}

interface YouTubeVideosResponse {
	items: YouTubeVideoItem[];
}

@Injectable()
export class YoutubeApiService {
	private readonly logger = new Logger(YoutubeApiService.name);

	constructor(private readonly configService: ConfigService) {}

	/**
	 * Parse ISO 8601 duration format to seconds
	 * Examples: PT4M13S -> 253, PT1H2M10S -> 3730, PT15S -> 15
	 */
	private parseISO8601Duration(duration: string): number {
		// Handle edge cases
		if (!duration || duration === 'PT0S' || duration === 'P0D') {
			return 0; // Live stream or invalid
		}

		const match =
			/P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/.exec(duration);

		if (!match) {
			this.logger.warn(`Invalid ISO 8601 duration format: ${duration}`);
			return 0;
		}

		const [, days, hours, minutes, seconds] = match;

		return (
			Number.parseInt(days || '0', 10) * 86400 +
			Number.parseInt(hours || '0', 10) * 3600 +
			Number.parseInt(minutes || '0', 10) * 60 +
			Number.parseFloat(seconds || '0')
		);
	}

	/**
	 * Batch-fetch video durations from YouTube API
	 * Processes video IDs in chunks of 50 (YouTube API limit)
	 */
	private async getVideoDurations(
		videoIds: string[],
		apiKey: string,
	): Promise<Record<string, number>> {
		const durationMap: Record<string, number> = {};

		// Chunk into batches of 50
		const chunks: string[][] = [];
		for (let i = 0; i < videoIds.length; i += 50) {
			chunks.push(videoIds.slice(i, i + 50));
		}

		this.logger.log(
			`Fetching durations for ${videoIds.length} videos in ${chunks.length} batches`,
		);

		// Process all batches
		for (const chunk of chunks) {
			try {
				const response = await axios.get<YouTubeVideosResponse>(
					'https://www.googleapis.com/youtube/v3/videos',
					{
						params: {
							part: 'contentDetails',
							id: chunk.join(','),
							key: apiKey,
						},
					},
				);

				for (const item of response.data.items || []) {
					const durationSeconds = this.parseISO8601Duration(
						item.contentDetails.duration,
					);
					durationMap[item.id] = durationSeconds;
				}
			} catch (error) {
				this.logger.error(
					`Failed to fetch duration batch: ${error instanceof Error ? error.message : 'Unknown error'}`,
				);
				// Continue with other batches even if one fails
			}
		}

		this.logger.log(
			`Successfully fetched ${Object.keys(durationMap).length} durations`,
		);
		return durationMap;
	}

	async getPlaylistItems(
		playlistUrl: string,
	): Promise<PlaylistVideoItem[] | null> {
		try {
			// Extract playlist ID from URL (list= parameter)
			const urlParams = new URLSearchParams(playlistUrl.split('?')[1]);
			const playlistId = urlParams.get('list');

			if (!playlistId) {
				this.logger.error('Invalid playlist URL: missing list parameter');
				return null;
			}

			const apiKey = this.configService.get<string>('YOUTUBE_API_KEY');
			if (!apiKey) {
				this.logger.error('YOUTUBE_API_KEY not configured');
				return null;
			}

			const videoItems: PlaylistVideoItem[] = [];
			let nextPageToken: string | undefined;

			// Fetch all pages using pagination
			while (true) {
				const params: Record<string, string> = {
					part: 'snippet',
					maxResults: '50',
					playlistId,
					key: apiKey,
				};

				if (nextPageToken) {
					params.pageToken = nextPageToken;
				}

				const response = await axios.get<YouTubePlaylistResponse>(
					'https://www.googleapis.com/youtube/v3/playlistItems',
					{ params },
				);

				const items = response.data.items || [];

				// Map items to video metadata objects (duration will be added later)
				for (const item of items) {
					const videoId = item.snippet.resourceId.videoId;
					const thumbnail =
						item.snippet.thumbnails?.high?.url ||
						item.snippet.thumbnails?.medium?.url ||
						item.snippet.thumbnails?.default?.url;

					videoItems.push({
						name: item.snippet.title,
						id: videoId,
						url: `https://www.youtube.com/watch?v=${videoId}`,
						thumbnail,
						uploader: item.snippet.videoOwnerChannelTitle,
						duration: 0, // Will be fetched in batch below
					});
				}

				// Check if there are more pages
				nextPageToken = response.data.nextPageToken;
				if (!nextPageToken) {
					break;
				}
			}

			this.logger.log(
				`Successfully fetched ${videoItems.length} videos from playlist ${playlistId}`,
			);

			// Batch-fetch durations for all videos
			const videoIds = videoItems.map((item) => item.id);
			const durationMap = await this.getVideoDurations(videoIds, apiKey);

			// Filter out deleted/private videos and map durations
			const validVideoItems = videoItems.filter((item) => {
				if (durationMap[item.id] === undefined) {
					this.logger.warn(
						`Removing deleted/private video from playlist: ${item.id} (${item.name})`,
					);
					return false;
				}
				item.duration = durationMap[item.id];
				return true;
			});

			this.logger.log(
				`Returning ${validVideoItems.length} valid videos (filtered ${videoItems.length - validVideoItems.length} deleted/private)`,
			);

			return validVideoItems;
		} catch (error) {
			this.logger.error(
				`Failed to fetch playlist items: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
			return null;
		}
	}
}
