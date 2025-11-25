import type { SnippetSessionEntry, SnippetSessionStop } from "../snippetSession";
import type { PluginSettings } from "../types";
import { findNextStop, findPrevStop } from "../utils/stopUtils";
import { StrategySelector } from "./strategySelector";

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
 * Shared implementation for index-based jump logic
 * Used by both StandardJumpStrategy and ReferenceJumpStrategy
 */
function selectNextByIndex(
    session: SnippetSessionEntry,
    currentIndex: number
): JumpCandidate | null {
    const nextStop = findNextStop(session, currentIndex);
    if (!nextStop) {
        return null;
    }
    return { index: nextStop.index, stop: nextStop };
}

/**
 * Shared implementation for previous jump logic
 * Used by both StandardJumpStrategy and ReferenceJumpStrategy
 */
function selectPrevByIndex(
    session: SnippetSessionEntry,
    currentIndex: number
): JumpCandidate | null {
    const prevStop = findPrevStop(session, currentIndex);
    if (!prevStop) {
        return null;
    }
    return { index: prevStop.index, stop: prevStop };
}

/**
 * Standard jump strategy - the default behavior
 * Implements simple index-based navigation
 */
export class StandardJumpStrategy implements TabStopJumpStrategy {
    selectNext(session: SnippetSessionEntry, currentIndex: number): JumpCandidate | null {
        return selectNextByIndex(session, currentIndex);
    }

    selectPrev(session: SnippetSessionEntry, currentIndex: number): JumpCandidate | null {
        return selectPrevByIndex(session, currentIndex);
    }

    matches(_stop: SnippetSessionStop): boolean {
        // Standard strategy matches all stops (default fallback)
        return true;
    }
}

/**
 * Reference jump strategy - handles reference-type tab stops
 * For reference stops, jump logic is the same as standard (based on index)
 * The synchronization behavior is handled separately
 */
export class ReferenceJumpStrategy implements TabStopJumpStrategy {
    selectNext(session: SnippetSessionEntry, currentIndex: number): JumpCandidate | null {
        return selectNextByIndex(session, currentIndex);
    }

    selectPrev(session: SnippetSessionEntry, currentIndex: number): JumpCandidate | null {
        return selectPrevByIndex(session, currentIndex);
    }

    matches(stop: SnippetSessionStop): boolean {
        // Match reference-type stops
        return stop.type === 'reference';
    }
}

/**
 * Selector for choosing the appropriate jump strategy
 */
export class TabStopJumpStrategySelector extends StrategySelector<TabStopJumpStrategy> {
    constructor() {
        const defaultStrategy = new StandardJumpStrategy();
        // Register strategies in priority order: function > reference > standard
        // Note: function strategy will be added in phase 3
        super(defaultStrategy, [
            new ReferenceJumpStrategy(),
            defaultStrategy,
        ]);
    }

    /**
     * Override beforeMatch to check if reference snippets are enabled
     */
    protected beforeMatch(stop: SnippetSessionStop, settings?: PluginSettings): boolean | undefined {
        // Check if reference snippets are enabled
        if (stop.type === 'reference' && settings && !settings.referenceSnippetEnabled) {
            // If disabled, fall back to standard strategy
            return true;
        }
        return undefined;
    }
}

