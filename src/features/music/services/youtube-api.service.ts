import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface PlaylistVideoItem {
	name: string;
	id: string;
	url: string;
	thumbnail?: string;
	uploader?: string;
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

@Injectable()
export class YoutubeApiService {
	private readonly logger = new Logger(YoutubeApiService.name);

	constructor(private readonly configService: ConfigService) {}

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

				// Map items to video metadata objects
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

			return videoItems;
		} catch (error) {
			this.logger.error(
				`Failed to fetch playlist items: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
			return null;
		}
	}
}
