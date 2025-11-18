import { EditorState } from '@codemirror/state';
import { snippetSessionField, pushSnippetSessionEffect, getSnippetSessionStack, isSnippetSessionActive } from '../src/snippetSession';
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
