/**
 * Generic strategy selector base class
 * Reduces code duplication between TabStopJumpStrategySelector and TabStopPlaceholderStrategySelector
 */
export abstract class StrategySelector<TStrategy> {
	protected strategies: TStrategy[] = [];
	protected defaultStrategy: TStrategy;

	constructor(defaultStrategy: TStrategy, initialStrategies: TStrategy[] = []) {
		this.defaultStrategy = defaultStrategy;
		this.strategies = [...initialStrategies];
	}

	/**
	 * Get the appropriate strategy for a given stop
	 * @param stop The tab stop to get strategy for
	 * @param settings Optional plugin settings
	 * @returns The matching strategy, or default if none match
	 */
	getStrategy(stop: unknown, settings?: unknown): TStrategy {
		// Allow subclasses to override beforeMatch hook for custom logic (e.g., settings checks)
		const shouldUseDefault = this.beforeMatch?.(stop, settings);
		if (shouldUseDefault) {
			return this.defaultStrategy;
		}

		// Match by priority using strategy.matches() method
		const matching = this.findMatchingStrategy(stop, (strategy, s) => {
			// Strategy must have a matches method
			return (strategy as any).matches?.(s) ?? false;
		});
		return matching ?? this.defaultStrategy;
	}

	/**
	 * Optional hook called before matching strategies
	 * Return true to use default strategy, false/undefined to continue matching
	 * @param stop The tab stop to check
	 * @param settings Optional plugin settings
	 * @returns true to use default strategy, false/undefined to continue
	 */
	protected beforeMatch?(stop: unknown, settings?: unknown): boolean | undefined;

	/**
	 * Add a new strategy to the selector
	 * @param strategy The strategy to add
	 * @param prepend If true, add to front (higher priority), otherwise add to end
	 */
	addStrategy(strategy: TStrategy, prepend: boolean = false): void {
		if (prepend) {
			this.strategies.unshift(strategy);
		} else {
			this.strategies.push(strategy);
		}
	}

	/**
	 * Find the first matching strategy
	 * @param stop The stop to match against
	 * @param matchesFn Function to check if a strategy matches
	 * @returns The matching strategy, or null if none match
	 */
	protected findMatchingStrategy(
		stop: unknown,
		matchesFn: (strategy: TStrategy, stop: unknown) => boolean
	): TStrategy | null {
		for (const strategy of this.strategies) {
			if (matchesFn(strategy, stop)) {
				return strategy;
			}
		}
		return null;
	}
}

