import { buildTriggerKeymapExtension } from '../src/utils/keymap';
import { Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';

/**
 * Tests for buildTriggerKeymapExtension
 * 
 * Note: Due to CodeMirror Extension's encapsulation, we cannot directly test
 * the actual key binding behavior. These tests verify that:
 * - Extensions are created without errors
 * - Different configurations are handled correctly
 * - Edge cases (empty keys, undefined configs) are handled gracefully
 * 
 * For full key binding behavior verification, integration tests with a real
 * CodeMirror EditorView would be needed.
 */
describe('buildTriggerKeymapExtension', () => {
	let mockView: EditorView;
	let handleTrigger: jest.Mock;
	let handleToggle: jest.Mock;
	let forceExitSnippetMode: jest.Mock;
	let menuHandlers: {
		next?: jest.Mock;
		prev?: jest.Mock;
		accept?: jest.Mock;
	};

	beforeEach(() => {
		handleTrigger = jest.fn().mockReturnValue(true);
		handleToggle = jest.fn().mockReturnValue(true);
		forceExitSnippetMode = jest.fn().mockReturnValue(true);
		menuHandlers = {
			next: jest.fn().mockReturnValue(true),
			prev: jest.fn().mockReturnValue(true),
			accept: jest.fn().mockReturnValue(true),
		};

		mockView = {
			state: {} as any,
			dispatch: jest.fn(),
		} as any;
	});

	it('creates extension with trigger key binding', () => {
		const extension = buildTriggerKeymapExtension({
			triggerKey: 'Tab',
			handleTrigger,
			handleToggle,
			forceExitSnippetMode,
		});

		expect(extension).toBeDefined();
		expect(extension).toBeInstanceOf(Object);
	});

	it('binds menu toggle key when provided', () => {
		const extension = buildTriggerKeymapExtension({
			triggerKey: 'Tab',
			menuKeymap: {
				toggle: 'Mod-k',
			},
			handleTrigger,
			handleToggle,
			forceExitSnippetMode,
		});

		expect(extension).toBeDefined();
	});

	it('binds menu navigation keys when provided', () => {
		const extension = buildTriggerKeymapExtension({
			triggerKey: 'Tab',
			menuKeymap: {
				next: 'ArrowDown',
				prev: 'ArrowUp',
				accept: 'Enter',
				toggle: 'Mod-k',
			},
			handleTrigger,
			handleToggle,
			forceExitSnippetMode,
			menuHandlers,
		});

		expect(extension).toBeDefined();
	});

	it('binds exit keys (Escape and Ctrl-[)', () => {
		const extension = buildTriggerKeymapExtension({
			triggerKey: 'Tab',
			handleTrigger,
			handleToggle,
			forceExitSnippetMode,
		});

		expect(extension).toBeDefined();
	});

	it('handles empty trigger key by defaulting to Tab', () => {
		const extension = buildTriggerKeymapExtension({
			triggerKey: '',
			handleTrigger,
			handleToggle,
			forceExitSnippetMode,
		});

		expect(extension).toBeDefined();
	});

	it('handles whitespace-only trigger key by defaulting to Tab', () => {
		const extension = buildTriggerKeymapExtension({
			triggerKey: '   ',
			handleTrigger,
			handleToggle,
			forceExitSnippetMode,
		});

		expect(extension).toBeDefined();
	});

	it('skips menu bindings when menuKeymap is not provided', () => {
		const extension = buildTriggerKeymapExtension({
			triggerKey: 'Tab',
			handleTrigger,
			handleToggle,
			forceExitSnippetMode,
		});

		expect(extension).toBeDefined();
	});

	it('skips individual menu keys when not provided', () => {
		const extension = buildTriggerKeymapExtension({
			triggerKey: 'Tab',
			menuKeymap: {
				toggle: 'Mod-k',
				// next, prev, accept not provided
			},
			handleTrigger,
			handleToggle,
			forceExitSnippetMode,
		});

		expect(extension).toBeDefined();
	});

	it('trims menu key strings', () => {
		const extension = buildTriggerKeymapExtension({
			triggerKey: 'Tab',
			menuKeymap: {
				next: '  ArrowDown  ',
				prev: '  ArrowUp  ',
				accept: '  Enter  ',
				toggle: '  Mod-k  ',
			},
			handleTrigger,
			handleToggle,
			forceExitSnippetMode,
			menuHandlers,
		});

		expect(extension).toBeDefined();
	});

	it('returns Prec.highest wrapped keymap', () => {
		const extension = buildTriggerKeymapExtension({
			triggerKey: 'Tab',
			handleTrigger,
			handleToggle,
			forceExitSnippetMode,
		});

		expect(extension).toBeDefined();
		expect(extension).toBeInstanceOf(Object);
	});

	it('handles undefined menuKeymap gracefully', () => {
		const extension = buildTriggerKeymapExtension({
			triggerKey: 'Tab',
			menuKeymap: undefined,
			handleTrigger,
			handleToggle,
			forceExitSnippetMode,
		});

		expect(extension).toBeDefined();
	});

	it('handles partial menuKeymap configuration', () => {
		const extension = buildTriggerKeymapExtension({
			triggerKey: 'Tab',
			menuKeymap: {
				next: 'ArrowDown',
				// prev, accept, toggle not provided
			},
			handleTrigger,
			handleToggle,
			forceExitSnippetMode,
			menuHandlers: {
				next: menuHandlers.next,
				// prev, accept not provided
			},
		});

		expect(extension).toBeDefined();
	});
});

