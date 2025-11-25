import { StandardJumpStrategy, TabStopJumpStrategySelector } from '../src/strategies/tabStopJumpStrategy';
import type { SnippetSessionEntry, SnippetSessionStop } from '../src/snippetSession';

describe('StandardJumpStrategy', () => {
	let strategy: StandardJumpStrategy;

	beforeEach(() => {
		strategy = new StandardJumpStrategy();
	});

	describe('selectNext', () => {
		it('selects the next tab stop in sequence', () => {
			const session: SnippetSessionEntry = {
				currentIndex: 1,
				stops: [
					{ index: 1, start: 0, end: 5 },
					{ index: 2, start: 6, end: 10 },
					{ index: 3, start: 11, end: 15 },
				],
			};

			const result = strategy.selectNext(session, 1);
			expect(result).not.toBeNull();
			expect(result?.index).toBe(2);
			expect(result?.stop.index).toBe(2);
		});

		it('jumps to $0 when no next stop exists and not at $0', () => {
			const session: SnippetSessionEntry = {
				currentIndex: 2,
				stops: [
					{ index: 1, start: 0, end: 5 },
					{ index: 2, start: 6, end: 10 },
					{ index: 0, start: 11, end: 15 },
				],
			};

			const result = strategy.selectNext(session, 2);
			expect(result).not.toBeNull();
			expect(result?.index).toBe(0);
			expect(result?.stop.index).toBe(0);
		});

		it('returns null when no next stop and no $0 exists', () => {
			const session: SnippetSessionEntry = {
				currentIndex: 2,
				stops: [
					{ index: 1, start: 0, end: 5 },
					{ index: 2, start: 6, end: 10 },
				],
			};

			const result = strategy.selectNext(session, 2);
			expect(result).toBeNull();
		});

		it('returns null when already at $0 and no other stops', () => {
			const session: SnippetSessionEntry = {
				currentIndex: 0,
				stops: [
					{ index: 0, start: 0, end: 5 },
				],
			};

			const result = strategy.selectNext(session, 0);
			expect(result).toBeNull();
		});

		it('handles non-sequential stop indices', () => {
			const session: SnippetSessionEntry = {
				currentIndex: 1,
				stops: [
					{ index: 1, start: 0, end: 5 },
					{ index: 5, start: 6, end: 10 },
					{ index: 10, start: 11, end: 15 },
				],
			};

			const result = strategy.selectNext(session, 1);
			expect(result).toBeNull(); // No stop with index 2
		});
	});

	describe('selectPrev', () => {
		it('selects the previous tab stop in sequence', () => {
			const session: SnippetSessionEntry = {
				currentIndex: 2,
				stops: [
					{ index: 1, start: 0, end: 5 },
					{ index: 2, start: 6, end: 10 },
					{ index: 3, start: 11, end: 15 },
				],
			};

			const result = strategy.selectPrev(session, 2);
			expect(result).not.toBeNull();
			expect(result?.index).toBe(1);
			expect(result?.stop.index).toBe(1);
		});

		it('returns null when no previous stop exists', () => {
			const session: SnippetSessionEntry = {
				currentIndex: 1,
				stops: [
					{ index: 1, start: 0, end: 5 },
					{ index: 2, start: 6, end: 10 },
				],
			};

			const result = strategy.selectPrev(session, 1);
			expect(result).toBeNull();
		});

		it('handles non-sequential stop indices', () => {
			const session: SnippetSessionEntry = {
				currentIndex: 5,
				stops: [
					{ index: 1, start: 0, end: 5 },
					{ index: 5, start: 6, end: 10 },
					{ index: 10, start: 11, end: 15 },
				],
			};

			const result = strategy.selectPrev(session, 5);
			expect(result).toBeNull(); // No stop with index 4
		});
	});

	describe('matches', () => {
		it('matches all stops (default fallback)', () => {
			const stop1: SnippetSessionStop = { index: 1, start: 0, end: 5 };
			const stop2: SnippetSessionStop = { index: 2, start: 6, end: 10, label: 'test' };
			const stop3: SnippetSessionStop = { index: 0, start: 11, end: 15 };

			expect(strategy.matches(stop1)).toBe(true);
			expect(strategy.matches(stop2)).toBe(true);
			expect(strategy.matches(stop3)).toBe(true);
		});
	});
});

describe('TabStopJumpStrategySelector', () => {
	let selector: TabStopJumpStrategySelector;

	beforeEach(() => {
		selector = new TabStopJumpStrategySelector();
	});

	describe('getStrategy', () => {
		it('returns default strategy for any stop (when no custom strategies are added)', () => {
			const stop: SnippetSessionStop = { index: 1, start: 0, end: 5 };
			const strategy = selector.getStrategy(stop);
			expect(strategy).toBeInstanceOf(StandardJumpStrategy);
		});
	});

	describe('addStrategy', () => {
		it('adds a custom strategy to the selector', () => {
			const customStrategy = new StandardJumpStrategy();
			selector.addStrategy(customStrategy);

			const stop: SnippetSessionStop = { index: 1, start: 0, end: 5 };
			const selectedStrategy = selector.getStrategy(stop);
			// Since StandardJumpStrategy matches all, it should still return default
			// But custom strategy is now in the list
			expect(selectedStrategy).toBeInstanceOf(StandardJumpStrategy);
		});

		it('allows multiple strategies to be added', () => {
			const strategy1 = new StandardJumpStrategy();
			const strategy2 = new StandardJumpStrategy();
			selector.addStrategy(strategy1);
			selector.addStrategy(strategy2);

			const stop: SnippetSessionStop = { index: 1, start: 0, end: 5 };
			const selectedStrategy = selector.getStrategy(stop);
			expect(selectedStrategy).toBeInstanceOf(StandardJumpStrategy);
		});
	});
});

