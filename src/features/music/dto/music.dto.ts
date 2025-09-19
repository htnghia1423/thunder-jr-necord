import { NumberOption, StringOption } from 'necord';

/**
 * DTO for /play command validation
 */
export class PlayDto {
	@StringOption({
		name: 'song',
		description: 'YouTube URL or search keywords',
		required: true,
	})
	song: string;
}

/**
 * DTO for /volume command validation
 */
export class VolumeDto {
	@NumberOption({
		name: 'level',
		description: 'Volume level from 1-100',
		required: true,
		min_value: 1,
		max_value: 100,
	})
	level: number;
}

/**
 * DTO for /remove command validation
 */
export class RemoveDto {
	@NumberOption({
		name: 'position',
		description: 'Song position in queue (starting from 1)',
		required: true,
		min_value: 1,
	})
	position: number;
}

/**
 * DTO for /loop command validation
 */
export class LoopDto {
	@StringOption({
		name: 'mode',
		description: 'Loop mode',
		required: false,
		choices: [
			{ name: 'Off', value: 'off' },
			{ name: 'Loop Song', value: 'song' },
			{ name: 'Loop Queue', value: 'queue' },
		],
	})
	mode?: 'off' | 'song' | 'queue';
}

/**
 * DTO for /seek command validation
 */
export class SeekDto {
	@NumberOption({
		name: 'seconds',
		description: 'Time to seek to (seconds)',
		required: true,
		min_value: 0,
	})
	seconds: number;
}
