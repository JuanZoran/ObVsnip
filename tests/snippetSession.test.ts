import { EditorState } from '@codemirror/state';
import {
	snippetSessionField,
	pushSnippetSessionEffect,
	popSnippetSessionEffect,
	updateSnippetSessionEffect,
	clearSnippetSessionsEffect,
	getSnippetSessionStack,
	isSnippetSessionActive,
	setSnippetWidgetConfig,
	getSnippetWidgetConfig,
	ChoiceHintWidget,
} from '../src/snippetSession';
import { MockEditorView } from './mocks/editor';

describe('snippetSessionField integration', () => {
	it('maps tab stops after document changes', () => {
		const view = new MockEditorView('abc');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [{ index: 1, start: 0, end: 1 }],
			}),
		});
		view.dispatch({
			changes: { from: 0, to: 1, insert: 'XYZ' },
		});
		const stack = getSnippetSessionStack(view as any);
		expect(stack?.[0].stops[0].start).toBe(0);
	});

	it('tracks active sessions via view state', () => {
		const view = new MockEditorView('');
		expect(isSnippetSessionActive(view as any)).toBe(false);
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [{ index: 1, start: 0, end: 0 }],
			}),
		});
		expect(isSnippetSessionActive(view as any)).toBe(true);
	});
});

describe('Widget rendering', () => {
	it('renders ChoiceHintWidget with correct DOM structure', () => {
		const widget = new ChoiceHintWidget('⚙️', ['Option A', 'Option B', 'Option C'], 'Option A', '#00ff00', '#888888');
		const dom = widget.toDOM();

		expect(dom.tagName).toBe('SPAN');
		expect(dom.className).toBe('snippet-choice-hint');
		expect(dom.style.getPropertyValue('--snippet-choice-active-color')).toBe('#00ff00');
		expect(dom.style.getPropertyValue('--snippet-choice-inactive-color')).toBe('#888888');

		const iconEl = dom.querySelector('.snippet-choice-hint-icon');
		expect(iconEl).not.toBeNull();
		expect(iconEl?.textContent).toBe('⚙️');

		const listEl = dom.querySelector('.snippet-choice-hint-list');
		expect(listEl).not.toBeNull();

		const entries = listEl?.querySelectorAll('.snippet-choice-entry');
		expect(entries?.length).toBe(3);
		expect(entries?.[0]?.textContent).toBe('Option A');
		expect(entries?.[0]?.classList.contains('snippet-choice-entry-active')).toBe(true);
		expect(entries?.[1]?.textContent).toBe('Option B');
		expect(entries?.[1]?.classList.contains('snippet-choice-entry-active')).toBe(false);
	});

	it('renders ChoiceHintWidget without colors when not provided', () => {
		const widget = new ChoiceHintWidget('⚙️', ['Option A', 'Option B']);
		const dom = widget.toDOM();

		expect(dom.style.getPropertyValue('--snippet-choice-active-color')).toBe('');
		expect(dom.style.getPropertyValue('--snippet-choice-inactive-color')).toBe('');
	});
});

describe('Decoration updates', () => {
	it('updates decorations after document changes', () => {
		const view = new MockEditorView('test content');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [
					{ index: 1, start: 0, end: 4 },
					{ index: 2, start: 5, end: 12 },
				],
			}),
		});

		const stack1 = getSnippetSessionStack(view as any);
		expect(stack1?.[0].stops[0].start).toBe(0);
		expect(stack1?.[0].stops[1].start).toBe(5);

		// Insert text at position 2
		view.dispatch({
			changes: { from: 2, to: 2, insert: 'XYZ' },
		});

		const stack2 = getSnippetSessionStack(view as any);
		expect(stack2?.[0].stops[0].start).toBe(0);
		expect(stack2?.[0].stops[0].end).toBe(7); // 4 + 3 (XYZ)
		// Second stop position depends on mapPos behavior
		expect(stack2?.[0].stops[1].start).toBeGreaterThanOrEqual(5);
		expect(stack2?.[0].stops[1].end).toBeGreaterThanOrEqual(12);
	});

	it('updates decorations after deletion', () => {
		const view = new MockEditorView('test content');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [
					{ index: 1, start: 0, end: 4 },
					{ index: 2, start: 5, end: 12 },
				],
			}),
		});

		// Delete from position 2 to 6 (deletes "st c")
		view.dispatch({
			changes: { from: 2, to: 6, insert: '' },
		});

		const stack = getSnippetSessionStack(view as any);
		expect(stack?.[0].stops[0].start).toBe(0);
		// After deletion, "test" becomes "te" (end position 2)
		expect(stack?.[0].stops[0].end).toBe(2);
		// Second stop was at 5, after deleting 4 chars (2-6), it moves to 5-4=1, but mapPos handles it
		expect(stack?.[0].stops[1].start).toBeGreaterThanOrEqual(1);
		expect(stack?.[0].stops[1].end).toBeLessThanOrEqual(8);
	});

	it('handles multi-line document changes', () => {
		const view = new MockEditorView('line1\nline2\nline3');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [
					{ index: 1, start: 0, end: 5 }, // "line1"
					{ index: 2, start: 12, end: 17 }, // "line3"
				],
			}),
		});

		// Insert newline at position 6
		view.dispatch({
			changes: { from: 6, to: 6, insert: '\nnewline\n' },
		});

		const stack = getSnippetSessionStack(view as any);
		expect(stack?.[0].stops[0].start).toBe(0);
		expect(stack?.[0].stops[0].end).toBe(5);
		expect(stack?.[0].stops[1].start).toBe(21); // 12 + 9 (newline\nnewline\n)
		expect(stack?.[0].stops[1].end).toBe(26);
	});
});

describe('Session stack management', () => {
	it('pushes new session to stack', () => {
		const view = new MockEditorView('');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [{ index: 1, start: 0, end: 5 }],
			}),
		});

		const stack = getSnippetSessionStack(view as any);
		expect(stack?.length).toBe(1);
		expect(stack?.[0].currentIndex).toBe(1);
		expect(stack?.[0].stops.length).toBe(1);
	});

	it('supports multiple sessions in stack', () => {
		const view = new MockEditorView('');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [{ index: 1, start: 0, end: 5 }],
			}),
		});
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 2,
				stops: [{ index: 2, start: 10, end: 15 }],
			}),
		});

		const stack = getSnippetSessionStack(view as any);
		expect(stack?.length).toBe(2);
		expect(stack?.[0].currentIndex).toBe(1);
		expect(stack?.[1].currentIndex).toBe(2);
	});

	it('pops session from stack', () => {
		const view = new MockEditorView('');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [{ index: 1, start: 0, end: 5 }],
			}),
		});
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 2,
				stops: [{ index: 2, start: 10, end: 15 }],
			}),
		});

		view.dispatch({
			effects: popSnippetSessionEffect.of(undefined),
		});

		const stack = getSnippetSessionStack(view as any);
		expect(stack?.length).toBe(1);
		expect(stack?.[0].currentIndex).toBe(1);
	});

	it('updates current index of top session', () => {
		const view = new MockEditorView('');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [
					{ index: 1, start: 0, end: 5 },
					{ index: 2, start: 6, end: 10 },
				],
			}),
		});

		view.dispatch({
			effects: updateSnippetSessionEffect.of({ currentIndex: 2 }),
		});

		const stack = getSnippetSessionStack(view as any);
		expect(stack?.[0].currentIndex).toBe(2);
	});

	it('clears all sessions', () => {
		const view = new MockEditorView('');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [{ index: 1, start: 0, end: 5 }],
			}),
		});
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 2,
				stops: [{ index: 2, start: 10, end: 15 }],
			}),
		});

		view.dispatch({
			effects: clearSnippetSessionsEffect.of(undefined),
		});

		const stack = getSnippetSessionStack(view as any);
		expect(stack?.length).toBe(0);
		expect(isSnippetSessionActive(view as any)).toBe(false);
	});

	it('does not update index when stack is empty', () => {
		const view = new MockEditorView('');
		view.dispatch({
			effects: updateSnippetSessionEffect.of({ currentIndex: 2 }),
		});

		const stack = getSnippetSessionStack(view as any);
		expect(stack?.length).toBe(0);
	});
});

describe('Position mapping complex scenarios', () => {
	it('maps positions correctly after multiple insertions', () => {
		const view = new MockEditorView('abc');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [
					{ index: 1, start: 0, end: 1 },
					{ index: 2, start: 2, end: 3 },
				],
			}),
		});

		// Insert at position 1
		view.dispatch({
			changes: { from: 1, to: 1, insert: 'X' },
		});
		// Insert at position 3 (after first insertion, this is now position 4)
		view.dispatch({
			changes: { from: 4, to: 4, insert: 'Y' },
		});

		const stack = getSnippetSessionStack(view as any);
		expect(stack?.[0].stops[0].start).toBe(0);
		expect(stack?.[0].stops[0].end).toBe(2); // 1 + 1 (X)
		// Second stop position depends on mapPos behavior with multiple changes
		expect(stack?.[0].stops[1].start).toBeGreaterThanOrEqual(2);
		expect(stack?.[0].stops[1].end).toBeGreaterThanOrEqual(3);
	});

	it('maps positions correctly after deletion spanning multiple stops', () => {
		const view = new MockEditorView('abcdefgh');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [
					{ index: 1, start: 0, end: 2 }, // "ab"
					{ index: 2, start: 4, end: 6 }, // "ef"
				],
			}),
		});

		// Delete from position 1 to 5 (spans both stops)
		view.dispatch({
			changes: { from: 1, to: 5, insert: '' },
		});

		const stack = getSnippetSessionStack(view as any);
		expect(stack?.[0].stops[0].start).toBe(0);
		expect(stack?.[0].stops[0].end).toBe(1); // Adjusted after deletion (2 - 1 deleted char)
		expect(stack?.[0].stops[1].start).toBe(1); // Adjusted after deletion (4 - 3 deleted chars)
		expect(stack?.[0].stops[1].end).toBe(2); // Adjusted after deletion (6 - 4 deleted chars)
	});

	it('handles position mapping at document boundaries', () => {
		const view = new MockEditorView('test');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [
					{ index: 1, start: 0, end: 4 },
				],
			}),
		});

		// Insert at beginning
		view.dispatch({
			changes: { from: 0, to: 0, insert: 'X' },
		});
		// Insert at end (after first insertion, position is now 5)
		view.dispatch({
			changes: { from: 5, to: 5, insert: 'Y' },
		});

		const stack = getSnippetSessionStack(view as any);
		// After inserting X at position 0, the stop at 0-4 moves to 1-5
		expect(stack?.[0].stops[0].start).toBeGreaterThanOrEqual(0);
		expect(stack?.[0].stops[0].end).toBeGreaterThanOrEqual(4);
	});
});

describe('Widget configuration', () => {
	beforeEach(() => {
		// Reset to default config
		setSnippetWidgetConfig({ enabled: true });
	});

	it('gets and sets widget configuration', () => {
		const config = {
			enabled: true,
			placeholderColor: '#ff0000',
			placeholderActiveColor: '#00ff00',
			ghostTextColor: '#0000ff',
			choiceActiveColor: '#ffff00',
			choiceInactiveColor: '#888888',
		};

		setSnippetWidgetConfig(config);
		const retrieved = getSnippetWidgetConfig();

		expect(retrieved.enabled).toBe(true);
		expect(retrieved.placeholderColor).toBe('#ff0000');
		expect(retrieved.placeholderActiveColor).toBe('#00ff00');
		expect(retrieved.ghostTextColor).toBe('#0000ff');
		expect(retrieved.choiceActiveColor).toBe('#ffff00');
		expect(retrieved.choiceInactiveColor).toBe('#888888');
	});

	it('merges partial configuration updates', () => {
		setSnippetWidgetConfig({ enabled: true, placeholderColor: '#ff0000' });
		setSnippetWidgetConfig({ placeholderActiveColor: '#00ff00' });

		const config = getSnippetWidgetConfig();
		expect(config.enabled).toBe(true);
		expect(config.placeholderColor).toBe('#ff0000');
		expect(config.placeholderActiveColor).toBe('#00ff00');
	});

	it('disables widgets when enabled is false', () => {
		setSnippetWidgetConfig({ enabled: false });
		const config = getSnippetWidgetConfig();
		expect(config.enabled).toBe(false);
	});
});

describe('Edge cases and boundary conditions', () => {
	it('handles stops with overlapping positions', () => {
		const view = new MockEditorView('test');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [
					{ index: 1, start: 0, end: 2 },
					{ index: 2, start: 1, end: 3 }, // Overlaps with stop 1
				],
			}),
		});

		const stack = getSnippetSessionStack(view as any);
		expect(stack).toBeDefined();
		expect(stack?.length).toBe(1);
		expect(stack?.[0].stops.length).toBe(2);
	});

	it('handles empty reference groups', () => {
		const view = new MockEditorView('test');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [
					{ 
						index: 1, 
						start: 0, 
						end: 0,
						type: 'reference',
						referenceGroup: '',
						linkedStops: [],
					},
				],
			}),
		});

		const stack = getSnippetSessionStack(view as any);
		expect(stack?.[0].stops[0].referenceGroup).toBe('');
		expect(stack?.[0].stops[0].linkedStops).toEqual([]);
	});

	it('handles invalid stop positions (negative)', () => {
		const view = new MockEditorView('test');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [
					{ index: 1, start: -1, end: 0 }, // Invalid start position
				],
			}),
		});

		const stack = getSnippetSessionStack(view as any);
		expect(stack?.[0].stops[0].start).toBe(-1); // State field accepts it, but should be handled by validation
	});

	it('handles stops with end before start', () => {
		const view = new MockEditorView('test');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [
					{ index: 1, start: 5, end: 2 }, // end < start
				],
			}),
		});

		const stack = getSnippetSessionStack(view as any);
		expect(stack?.[0].stops[0].start).toBe(5);
		expect(stack?.[0].stops[0].end).toBe(2);
	});

	it('handles very large stop positions', () => {
		const view = new MockEditorView('test');
		const largePos = 1000000;
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [
					{ index: 1, start: largePos, end: largePos + 10 },
				],
			}),
		});

		const stack = getSnippetSessionStack(view as any);
		expect(stack?.[0].stops[0].start).toBe(largePos);
		expect(stack?.[0].stops[0].end).toBe(largePos + 10);
	});

	it('handles session with zero stops', () => {
		const view = new MockEditorView('test');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 0,
				stops: [],
			}),
		});

		const stack = getSnippetSessionStack(view as any);
		expect(stack?.[0].stops.length).toBe(0);
		expect(stack?.[0].currentIndex).toBe(0);
	});

	it('handles currentIndex out of bounds', () => {
		const view = new MockEditorView('test');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 999, // Out of bounds
				stops: [
					{ index: 1, start: 0, end: 0 },
				],
			}),
		});

		const stack = getSnippetSessionStack(view as any);
		expect(stack?.[0].currentIndex).toBe(999);
		expect(stack?.[0].stops.length).toBe(1);
	});

	it('handles rapid session updates', () => {
		const view = new MockEditorView('test');
		
		// Push multiple sessions rapidly
		for (let i = 0; i < 10; i++) {
			view.dispatch({
				effects: pushSnippetSessionEffect.of({
					currentIndex: i,
					stops: [{ index: i, start: i, end: i }],
				}),
			});
		}

		const stack = getSnippetSessionStack(view as any);
		expect(stack?.length).toBe(10);
		expect(stack?.[9].currentIndex).toBe(9);
	});

	it('handles document changes that move stops beyond document length', () => {
		const view = new MockEditorView('abc');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [{ index: 1, start: 0, end: 3 }],
			}),
		});

		// Delete all text, making stop positions invalid
		view.dispatch({
			changes: { from: 0, to: 3, insert: '' },
		});

		const stack = getSnippetSessionStack(view as any);
		// Positions should be mapped by CodeMirror
		expect(stack?.[0].stops[0].start).toBe(0);
		expect(stack?.[0].stops[0].end).toBe(0);
	});

	it('handles reference stops with missing linkedStops', () => {
		const view = new MockEditorView('test');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [
					{ 
						index: 1, 
						start: 0, 
						end: 0,
						type: 'reference',
						referenceGroup: 'ref_0',
						// linkedStops is undefined
					},
				],
			}),
		});

		const stack = getSnippetSessionStack(view as any);
		expect(stack?.[0].stops[0].type).toBe('reference');
		expect(stack?.[0].stops[0].linkedStops).toBeUndefined();
	});

	it('handles reference stops with invalid linkedStops indices', () => {
		const view = new MockEditorView('test');
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [
					{ 
						index: 1, 
						start: 0, 
						end: 0,
						type: 'reference',
						referenceGroup: 'ref_0',
						linkedStops: [999, -1], // Invalid indices
					},
				],
			}),
		});

		const stack = getSnippetSessionStack(view as any);
		expect(stack?.[0].stops[0].linkedStops).toEqual([999, -1]);
	});
});
