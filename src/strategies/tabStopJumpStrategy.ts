import type { Editor } from "obsidian";
import type { SnippetSessionEntry, SnippetSessionStop } from "../snippetSession";
import type { PluginSettings } from "../types";

/**
 * Represents a candidate for tab stop jump
 */
export type JumpCandidate = {
    index: number;
    stop: SnippetSessionStop;
};

/**
 * Strategy interface for tab stop jump behavior
 * Handles how to find the next/previous tab stop
 */
export interface TabStopJumpStrategy {
    /**
     * Select the next tab stop from the current position
     * @param session The current snippet session
     * @param currentIndex The current tab stop index
     * @returns The next jump candidate, or null if no more stops
     */
    selectNext(session: SnippetSessionEntry, currentIndex: number): JumpCandidate | null;

    /**
     * Select the previous tab stop from the current position
     * @param session The current snippet session
     * @param currentIndex The current tab stop index
     * @returns The previous jump candidate, or null if no previous stop
     */
    selectPrev(session: SnippetSessionEntry, currentIndex: number): JumpCandidate | null;

    /**
     * Check if this strategy matches the given stop
     * @param stop The tab stop to check
     * @returns true if this strategy should handle this stop
     */
    matches(stop: SnippetSessionStop): boolean;
}

/**
 * Standard jump strategy - the default behavior
 * Implements simple index-based navigation
 */
export class StandardJumpStrategy implements TabStopJumpStrategy {
    selectNext(session: SnippetSessionEntry, currentIndex: number): JumpCandidate | null {
        let nextTabIndex = currentIndex + 1;
        let nextTabStop = session.stops.find((t) => t.index === nextTabIndex);
        
        // If no next stop found and not at $0, try to jump to $0
        if (!nextTabStop && currentIndex !== 0) {
            nextTabIndex = 0;
            nextTabStop = session.stops.find((t) => t.index === 0);
        }

        if (!nextTabStop) {
            return null;
        }

        return { index: nextTabIndex, stop: nextTabStop };
    }

    selectPrev(session: SnippetSessionEntry, currentIndex: number): JumpCandidate | null {
        const prevTabIndex = currentIndex - 1;
        const prevTabStop = session.stops.find((t) => t.index === prevTabIndex);
        
        if (!prevTabStop) {
            return null;
        }
        
        return { index: prevTabIndex, stop: prevTabStop };
    }

    matches(_stop: SnippetSessionStop): boolean {
        // Standard strategy matches all stops (default fallback)
        return true;
    }
}

/**
 * Selector for choosing the appropriate jump strategy
 */
export class TabStopJumpStrategySelector {
    private strategies: TabStopJumpStrategy[];
    private defaultStrategy: TabStopJumpStrategy;

    constructor() {
        this.defaultStrategy = new StandardJumpStrategy();
        this.strategies = [this.defaultStrategy];
    }

    /**
     * Get the appropriate jump strategy for a given stop
     * @param stop The tab stop to get strategy for
     * @param settings Plugin settings (for future use with feature flags)
     * @returns The matching strategy, or default if none match
     */
    getStrategy(stop: SnippetSessionStop, settings?: PluginSettings): TabStopJumpStrategy {
        // In phase 1, we only have StandardJumpStrategy
        // Future phases will check settings and match by priority: function > reference > standard
        for (const strategy of this.strategies) {
            if (strategy.matches(stop)) {
                // Phase 1: No feature flags to check yet
                // Future: if (this.isStrategyEnabled(strategy, stop, settings)) {
                return strategy;
            }
        }
        return this.defaultStrategy;
    }

    /**
     * Add a new strategy to the selector
     * @param strategy The strategy to add
     */
    addStrategy(strategy: TabStopJumpStrategy): void {
        this.strategies.push(strategy);
    }
}

