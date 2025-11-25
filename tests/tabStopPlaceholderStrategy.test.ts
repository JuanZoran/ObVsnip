import {
	StandardPlaceholderStrategy,
	ChoicePlaceholderStrategy,
	TabStopPlaceholderStrategySelector,
	type TabStopPlaceholderStrategy,
} from '../src/strategies/tabStopPlaceholderStrategy';
import type { SnippetSessionStop } from '../src/snippetSession';
import { MockEditor } from './mocks/editor';

describe('StandardPlaceholderStrategy', () => {
	let strategy: StandardPlaceholderStrategy;
	let mockEditor: MockEditor;

	beforeEach(() => {
		strategy = new StandardPlaceholderStrategy();
		mockEditor = new MockEditor('test');
	});

	describe('onStopInitialized', () => {
		it('does nothing for standard stops', () => {
			const stop: SnippetSessionStop = { index: 1, start: 0, end: 4 };
			expect(() => {
				strategy.onStopInitialized?.(mockEditor as any, stop);
			}).not.toThrow();
		});
	});

	describe('onStopFocused', () => {
		it('does nothing for standard stops', () => {
			const stop: SnippetSessionStop = { index: 1, start: 0, end: 4 };
			expect(() => {
				strategy.onStopFocused?.(mockEditor as any, stop);
			}).not.toThrow();
		});
	});

	describe('matches', () => {
		it('matches all stops (fallback)', () => {
			const stop1: SnippetSessionStop = { index: 1, start: 0, end: 5 };
			const stop2: SnippetSessionStop = { index: 2, start: 6, end: 10, label: 'test' };
			const stop3: SnippetSessionStop = { index: 0, start: 11, end: 15 };

			expect(strategy.matches(stop1)).toBe(true);
			expect(strategy.matches(stop2)).toBe(true);
			expect(strategy.matches(stop3)).toBe(true);
		});
	});
});

describe('ChoicePlaceholderStrategy', () => {
	let strategy: ChoicePlaceholderStrategy;
	let mockEditor: MockEditor;

	beforeEach(() => {
		strategy = new ChoicePlaceholderStrategy();
		mockEditor = new MockEditor('Option A');
	});

	describe('matches', () => {
		it('matches stops with choices', () => {
			const stop: SnippetSessionStop = {
				index: 1,
				start: 0,
				end: 8,
				choices: ['Option A', 'Option B', 'Option C'],
			};
			expect(strategy.matches(stop)).toBe(true);
		});

		it('does not match stops without choices', () => {
			const stop: SnippetSessionStop = { index: 1, start: 0, end: 5 };
			expect(strategy.matches(stop)).toBe(false);
		});

		it('does not match stops with empty choices array', () => {
			const stop: SnippetSessionStop = { index: 1, start: 0, end: 5, choices: [] };
			expect(strategy.matches(stop)).toBe(false);
		});
	});

	describe('getSpecialActions', () => {
		it('returns cycleChoice action', () => {
			const stop: SnippetSessionStop = {
				index: 1,
				start: 0,
				end: 8,
				choices: ['Option A', 'Option B'],
			};
			const actions = strategy.getSpecialActions?.(stop);
			expect(actions).toEqual(['cycleChoice']);
		});
	});

	describe('executeSpecialAction', () => {
		it('cycles through choice options', () => {
			const stop: SnippetSessionStop = {
				index: 1,
				start: 0,
				end: 8,
				choices: ['Option A', 'Option B', 'Option C'],
			};
			mockEditor = new MockEditor('Option A');
			mockEditor.setSelection(mockEditor.offsetToPos(0), mockEditor.offsetToPos(8));

			const result = strategy.executeSpecialAction?.(mockEditor as any, stop, 'cycleChoice');
			expect(result).toBe(true);
			expect(mockEditor.getRange(mockEditor.offsetToPos(0), mockEditor.offsetToPos(8))).toBe('Option B');
		});

		it('wraps around to first option when at last option', () => {
			const stop: SnippetSessionStop = {
				index: 1,
				start: 0,
				end: 8,
				choices: ['Option A', 'Option B', 'Option C'],
			};
			mockEditor = new MockEditor('Option C');
			mockEditor.setSelection(mockEditor.offsetToPos(0), mockEditor.offsetToPos(8));

			const result = strategy.executeSpecialAction?.(mockEditor as any, stop, 'cycleChoice');
			expect(result).toBe(true);
			expect(mockEditor.getRange(mockEditor.offsetToPos(0), mockEditor.offsetToPos(8))).toBe('Option A');
		});

		it('selects first option when current text does not match any choice', () => {
			const stop: SnippetSessionStop = {
				index: 1,
				start: 0,
				end: 7,
				choices: ['Option A', 'Option B'],
			};
			mockEditor = new MockEditor('Unknown');
			mockEditor.setSelection(mockEditor.offsetToPos(0), mockEditor.offsetToPos(6));

			const result = strategy.executeSpecialAction?.(mockEditor as any, stop, 'cycleChoice');
			expect(result).toBe(true);
			const newEnd = mockEditor.posToOffset(mockEditor.getCursor('to'));
			expect(mockEditor.getRange(mockEditor.offsetToPos(0), mockEditor.offsetToPos(newEnd))).toBe('Option A');
		});

		it('updates stop end position after cycling', () => {
			const stop: SnippetSessionStop = {
				index: 1,
				start: 0,
				end: 8,
				choices: ['Option A', 'Option B', 'Option C'],
			};
			mockEditor = new MockEditor('Option A');
			mockEditor.setSelection(mockEditor.offsetToPos(0), mockEditor.offsetToPos(8));

			strategy.executeSpecialAction?.(mockEditor as any, stop, 'cycleChoice');
			const newEnd = mockEditor.posToOffset(mockEditor.getCursor('to'));
			// After cycling to Option B, the end position should be updated
			expect(newEnd).toBeGreaterThanOrEqual(8);
		});

		it('returns false for invalid action', () => {
			const stop: SnippetSessionStop = {
				index: 1,
				start: 0,
				end: 8,
				choices: ['Option A', 'Option B'],
			};
			const result = strategy.executeSpecialAction?.(mockEditor as any, stop, 'invalidAction');
			expect(result).toBe(false);
		});

		it('returns false when stop has no choices', () => {
			const stop: SnippetSessionStop = { index: 1, start: 0, end: 5 };
			const result = strategy.executeSpecialAction?.(mockEditor as any, stop, 'cycleChoice');
			expect(result).toBe(false);
		});

		it('returns false when stop has empty choices array', () => {
			const stop: SnippetSessionStop = { index: 1, start: 0, end: 5, choices: [] };
			const result = strategy.executeSpecialAction?.(mockEditor as any, stop, 'cycleChoice');
			expect(result).toBe(false);
		});

		it('handles single choice option', () => {
			const stop: SnippetSessionStop = {
				index: 1,
				start: 0,
				end: 11,
				choices: ['Only Option'],
			};
			mockEditor = new MockEditor('Only Option');
			mockEditor.setSelection(mockEditor.offsetToPos(0), mockEditor.offsetToPos(11));

			const result = strategy.executeSpecialAction?.(mockEditor as any, stop, 'cycleChoice');
			expect(result).toBe(true);
			const newEnd = mockEditor.posToOffset(mockEditor.getCursor('to'));
			expect(mockEditor.getRange(mockEditor.offsetToPos(0), mockEditor.offsetToPos(newEnd))).toBe('Only Option');
		});
	});

	describe('onStopFocused', () => {
		it('does nothing (hint widget handled elsewhere)', () => {
			const stop: SnippetSessionStop = {
				index: 1,
				start: 0,
				end: 8,
				choices: ['Option A', 'Option B'],
			};
			expect(() => {
				strategy.onStopFocused?.(mockEditor as any, stop);
			}).not.toThrow();
		});
	});
});

describe('TabStopPlaceholderStrategySelector', () => {
	let selector: TabStopPlaceholderStrategySelector;

	beforeEach(() => {
		selector = new TabStopPlaceholderStrategySelector();
	});

	describe('getStrategy', () => {
		it('returns ChoicePlaceholderStrategy for stops with choices', () => {
			const stop: SnippetSessionStop = {
				index: 1,
				start: 0,
				end: 8,
				choices: ['Option A', 'Option B'],
			};
			const strategy = selector.getStrategy(stop);
			expect(strategy).toBeInstanceOf(ChoicePlaceholderStrategy);
		});

		it('returns StandardPlaceholderStrategy for stops without choices', () => {
			const stop: SnippetSessionStop = { index: 1, start: 0, end: 5 };
			const strategy = selector.getStrategy(stop);
			expect(strategy).toBeInstanceOf(StandardPlaceholderStrategy);
		});

		it('prioritizes choice strategy over standard strategy', () => {
			const choiceStop: SnippetSessionStop = {
				index: 1,
				start: 0,
				end: 8,
				choices: ['Option A'],
			};
			const standardStop: SnippetSessionStop = { index: 2, start: 9, end: 14 };

			const choiceStrategy = selector.getStrategy(choiceStop);
			const standardStrategy = selector.getStrategy(standardStop);

			expect(choiceStrategy).toBeInstanceOf(ChoicePlaceholderStrategy);
			expect(standardStrategy).toBeInstanceOf(StandardPlaceholderStrategy);
		});
	});

	describe('addStrategy', () => {
		it('adds a custom strategy to the front of the list with higher priority', () => {
			// Create a custom strategy that only matches stops with a specific label
			class CustomLabelStrategy implements TabStopPlaceholderStrategy {
				matches(stop: SnippetSessionStop): boolean {
					return stop.label === 'custom';
				}
			}

			const customStrategy = new CustomLabelStrategy();
			selector.addStrategy(customStrategy);

			// Test that custom strategy is selected when it matches
			const customStop: SnippetSessionStop = { index: 1, start: 0, end: 5, label: 'custom' };
			const selectedStrategy = selector.getStrategy(customStop);
			expect(selectedStrategy).toBeInstanceOf(CustomLabelStrategy);

			// Test that standard strategy is used when custom doesn't match
			const standardStop: SnippetSessionStop = { index: 2, start: 6, end: 10 };
			const standardStrategy = selector.getStrategy(standardStop);
			expect(standardStrategy).toBeInstanceOf(StandardPlaceholderStrategy);
		});

		it('allows multiple strategies to be added with priority order', () => {
			// Create custom strategies with different matching criteria
			class FirstStrategy implements TabStopPlaceholderStrategy {
				matches(stop: SnippetSessionStop): boolean {
					return stop.index === 1;
				}
			}

			class SecondStrategy implements TabStopPlaceholderStrategy {
				matches(stop: SnippetSessionStop): boolean {
					return stop.index === 2;
				}
			}

			const firstStrategy = new FirstStrategy();
			const secondStrategy = new SecondStrategy();
			selector.addStrategy(secondStrategy); // Added second, but should be checked first
			selector.addStrategy(firstStrategy); // Added first, should be checked second

			// First strategy should match index 1 (added later, checked first)
			const stop1: SnippetSessionStop = { index: 1, start: 0, end: 5 };
			const selected1 = selector.getStrategy(stop1);
			expect(selected1).toBeInstanceOf(FirstStrategy);

			// Second strategy should match index 2
			const stop2: SnippetSessionStop = { index: 2, start: 6, end: 10 };
			const selected2 = selector.getStrategy(stop2);
			expect(selected2).toBeInstanceOf(SecondStrategy);
		});
	});
});

