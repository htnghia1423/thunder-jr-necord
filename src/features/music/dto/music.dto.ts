import { NumberOption, StringOption } from 'necord';

/**
 * DTO for /play command validation
 */
export class PlayDto {
	@StringOption({
		name: 'song',
		description: 'YouTube URL hoặc từ khóa tìm kiếm',
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
		description: 'Mức âm lượng từ 1-100',
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
		description: 'Vị trí bài hát trong hàng đợi (bắt đầu từ 1)',
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
		description: 'Chế độ lặp',
		required: false,
		choices: [
			{ name: 'Tắt', value: 'off' },
			{ name: 'Lặp bài hát', value: 'song' },
			{ name: 'Lặp hàng đợi', value: 'queue' },
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
		description: 'Thời gian cần chuyển đến (giây)',
		required: true,
		min_value: 0,
	})
	seconds: number;
}
