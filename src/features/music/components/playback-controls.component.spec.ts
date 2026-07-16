import { ButtonStyle } from 'discord.js';

import { PlaybackControlsComponent } from './playback-controls.component';

const row0 = (opts?: any): any[] =>
	PlaybackControlsComponent.create(opts).toJSON().components as any[];

describe('PlaybackControlsComponent.create', () => {
	it('renders the five transport buttons with default states', () => {
		const [prev, playPause, stop, skip, loop] = row0();
		expect(prev.custom_id).toBe('music_prev');
		expect(playPause.custom_id).toBe('music_play_pause');
		expect(stop.custom_id).toBe('music_stop');
		expect(skip.custom_id).toBe('music_skip');
		expect(loop.custom_id).toBe('music_loop');

		// no previous songs by default -> prev disabled; hasNextSongs defaults true -> skip enabled
		expect(prev.disabled).toBe(true);
		expect(skip.disabled).toBe(false);
		// not paused -> Primary play/pause button
		expect(playPause.style).toBe(ButtonStyle.Primary);
	});

	it('shows a Success play button when paused', () => {
		const [, playPause] = row0({ isPaused: true });
		expect(playPause.style).toBe(ButtonStyle.Success);
	});

	it('reflects previous/next availability', () => {
		const [prev, , , skip] = row0({
			hasPreviousSongs: true,
			hasNextSongs: false,
		});
		expect(prev.disabled).toBe(false);
		expect(skip.disabled).toBe(true);
	});

	it('disables all buttons when disabled is set', () => {
		expect(row0({ disabled: true }).every((b) => b.disabled === true)).toBe(
			true,
		);
	});
});

describe('PlaybackControlsComponent.createRows', () => {
	it('includes a lyrics/refresh row by default', () => {
		const rows = PlaybackControlsComponent.createRows();
		expect(rows).toHaveLength(2);
		const second = rows[1].toJSON().components as any[];
		expect(second.map((b) => b.custom_id)).toEqual([
			'music_lyrics',
			'music_refresh',
		]);
	});

	it('omits the secondary row when includeLyrics is false', () => {
		expect(
			PlaybackControlsComponent.createRows({ includeLyrics: false }),
		).toHaveLength(1);
	});
});
