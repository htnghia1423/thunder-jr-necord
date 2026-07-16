import { ButtonStyle } from 'discord.js';

import { PaginationControlsComponent } from './pagination-controls.component';

const buttons = (opts: any): any[] =>
	PaginationControlsComponent.create(opts).toJSON().components as any[];

describe('PaginationControlsComponent', () => {
	it('disables Previous on the first page and enables Next', () => {
		const [prev, next] = buttons({ currentPage: 1, totalPages: 3 });
		expect(prev.custom_id).toBe('previous');
		expect(prev.disabled).toBe(true);
		expect(next.custom_id).toBe('next');
		expect(next.disabled).toBe(false);
		expect(prev.style).toBe(ButtonStyle.Primary);
	});

	it('disables Next on the last page', () => {
		const [prev, next] = buttons({ currentPage: 3, totalPages: 3 });
		expect(prev.disabled).toBe(false);
		expect(next.disabled).toBe(true);
	});

	it('enables both controls on a middle page', () => {
		const [prev, next] = buttons({ currentPage: 2, totalPages: 3 });
		expect(prev.disabled).toBe(false);
		expect(next.disabled).toBe(false);
	});

	it('honors custom button ids', () => {
		const [prev, next] = buttons({
			currentPage: 1,
			totalPages: 2,
			customIds: { previous: 'p_prev', next: 'p_next' },
		});
		expect(prev.custom_id).toBe('p_prev');
		expect(next.custom_id).toBe('p_next');
	});
});
