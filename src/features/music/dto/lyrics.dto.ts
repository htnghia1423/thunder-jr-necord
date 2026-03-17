import { StringOption } from 'necord';

/**
 * DTO for /lyrics command validation
 */
export class LyricsDto {
	@StringOption({
		name: 'query',
		description:
			'Song name to search for (optional - uses current song if not provided)',
		required: false,
	})
	query?: string;
}
