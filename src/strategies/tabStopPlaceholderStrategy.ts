import type { Editor } from "obsidian";
import type { SnippetSessionStop } from "../snippetSession";
import type { PluginSettings } from "../types";

/**
 * Strategy interface for tab stop placeholder behavior
 * Handles how different types of tab stops behave (initialization, focus, editing, special actions)
 */
export interface TabStopPlaceholderStrategy {
    /**
     * Called when a stop is initialized (after snippet insertion)
     * @param editor The editor instance
     * @param stop The tab stop being initialized
     */
    onStopInitialized?(editor: Editor, stop: SnippetSessionStop): void;

    /**
     * Called when a stop is focused
     * @param editor The editor instance
     * @param stop The tab stop being focused
     */
    onStopFocused?(editor: Editor, stop: SnippetSessionStop): void;

    /**
     * Called when a stop is edited (for sync updates in future phases)
     * @param editor The editor instance
     * @param stop The tab stop being edited
     * @param newText The new text content
     * @param settings Plugin settings
     */
    onStopEdited?(editor: Editor, stop: SnippetSessionStop, newText: string, settings: PluginSettings): void;

    /**
     * Check if this strategy matches the given stop
     * @param stop The tab stop to check
     * @returns true if this strategy should handle this stop
     */
    matches(stop: SnippetSessionStop): boolean;

    /**
     * Get available special actions for this stop
     * @param stop The tab stop
     * @returns Array of action names (e.g., ['cycleChoice'])
     */
    getSpecialActions?(stop: SnippetSessionStop): string[];

    /**
     * Execute a special action
     * @param editor The editor instance
     * @param stop The tab stop
     * @param action The action name to execute
     * @returns true if action was executed successfully
     */
    executeSpecialAction?(editor: Editor, stop: SnippetSessionStop, action: string): boolean;
}

/**
 * Standard placeholder strategy - default behavior
 * Handles standard tab stops with no special behavior
 */
export class StandardPlaceholderStrategy implements TabStopPlaceholderStrategy {
    onStopInitialized(_editor: Editor, _stop: SnippetSessionStop): void {
        // Standard stops don't need special initialization
    }

    onStopFocused(_editor: Editor, _stop: SnippetSessionStop): void {
        // Standard stops don't need special focus handling
    }

    matches(_stop: SnippetSessionStop): boolean {
        // Standard strategy matches all stops (fallback)
        return true;
    }
}

/**
 * Choice placeholder strategy - handles choice tab stops
 * Manages cycling through choice options
 */
export class ChoicePlaceholderStrategy implements TabStopPlaceholderStrategy {
    matches(stop: SnippetSessionStop): boolean {
        // Match stops that have choices
        return !!(stop.choices && stop.choices.length > 0);
    }

    getSpecialActions(_stop: SnippetSessionStop): string[] {
        return ['cycleChoice'];
    }

    executeSpecialAction(editor: Editor, stop: SnippetSessionStop, action: string): boolean {
        if (action !== 'cycleChoice') {
            return false;
        }

        // Note: matches() already checks for choices, but this is a defensive check
        // in case executeSpecialAction is called directly without going through matches()
        if (!stop.choices || stop.choices.length === 0) {
            return false;
        }

        const from = editor.offsetToPos(stop.start);
        const to = editor.offsetToPos(stop.end);
        const currentText = editor.getRange(from, to);
        const len = stop.choices.length;
        const currentIndex = stop.choices.findIndex(choice => choice === currentText);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % len : 0;
        const nextValue = stop.choices[nextIndex] ?? '';

        editor.replaceRange(nextValue, from, to);

        const startOffset = editor.posToOffset(from);
        const newEndOffset = startOffset + nextValue.length;
        const newEndPos = editor.offsetToPos(newEndOffset);

        editor.setSelection(from, newEndPos);

        return true;
    }

    onStopFocused(_editor: Editor, _stop: SnippetSessionStop): void {
        // Choice hint widget is handled in snippetSession.ts
        // This method can be used for future enhancements
    }
}

/**
 * Selector for choosing the appropriate placeholder strategy
 */
export class TabStopPlaceholderStrategySelector {
    private strategies: TabStopPlaceholderStrategy[];
    private defaultStrategy: TabStopPlaceholderStrategy;

    constructor() {
        this.defaultStrategy = new StandardPlaceholderStrategy();
        // Order matters: more specific strategies should come first
        this.strategies = [
            new ChoicePlaceholderStrategy(),
            this.defaultStrategy, // Fallback
        ];
    }

    /**
     * Get the appropriate placeholder strategy for a given stop
     * @param stop The tab stop to get strategy for
     * @param settings Plugin settings (for future use)
     * @returns The matching strategy, or default if none match
     */
    getStrategy(stop: SnippetSessionStop, settings?: PluginSettings): TabStopPlaceholderStrategy {
        // Match by specificity: choice > default > standard
        for (const strategy of this.strategies) {
            if (strategy.matches(stop)) {
                return strategy;
            }
        }
        return this.defaultStrategy;
    }

    /**
     * Add a new strategy to the selector
     * @param strategy The strategy to add
     */
    addStrategy(strategy: TabStopPlaceholderStrategy): void {
        this.strategies.unshift(strategy); // Add to front for higher priority
    }
}

