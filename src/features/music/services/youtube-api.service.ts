import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface YouTubePlaylistItemSnippet {
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

	async getPlaylistItems(playlistUrl: string): Promise<string[] | null> {
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

			const videoUrls: string[] = [];
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

				// Map items to video URLs
				for (const item of items) {
					const videoId = item.snippet.resourceId.videoId;
					videoUrls.push(`https://www.youtube.com/watch?v=${videoId}`);
				}

				// Check if there are more pages
				nextPageToken = response.data.nextPageToken;
				if (!nextPageToken) {
					break;
				}
			}

			this.logger.log(
				`Successfully fetched ${videoUrls.length} videos from playlist ${playlistId}`,
			);

			return videoUrls;
		} catch (error) {
			this.logger.error(
				`Failed to fetch playlist items: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
			return null;
		}
	}
}
