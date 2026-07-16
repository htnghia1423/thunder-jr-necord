import { PlaylistDuplicateAction } from '../enums/playlist-duplicate.enum';
import { ButtonStyle } from 'discord.js';

import { DuplicateControlsComponent } from './duplicate-controls.component';

const buttons = (opts?: any): any[] =>
	DuplicateControlsComponent.create(opts).toJSON().components as any[];

describe('DuplicateControlsComponent', () => {
	it('builds Add All / New Only / Cancel with namespaced custom ids and styles', () => {
		const [addAll, newOnly, cancel] = buttons();
		expect(addAll.custom_id).toBe(
			`playlist_duplicate_${PlaylistDuplicateAction.ADD_ALL}`,
		);
		expect(newOnly.custom_id).toBe(
			`playlist_duplicate_${PlaylistDuplicateAction.NEW_ONLY}`,
		);
		expect(cancel.custom_id).toBe(
			`playlist_duplicate_${PlaylistDuplicateAction.CANCEL}`,
		);
		expect(addAll.style).toBe(ButtonStyle.Primary);
		expect(newOnly.style).toBe(ButtonStyle.Success);
		expect(cancel.style).toBe(ButtonStyle.Danger);
		expect(addAll.disabled).toBe(false);
	});

	it('disables every button when disabled is set', () => {
		const rows = buttons({ disabled: true });
		expect(rows).toHaveLength(3);
		expect(rows.every((b) => b.disabled === true)).toBe(true);
	});
});
