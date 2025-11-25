import type { SnippetWidgetConfig } from '../snippetSession';

/**
 * Build CSS style string from snippet widget config
 * @param config The widget configuration
 * @param separator Style property separator (default: "; " for attributes, ";" for cssText)
 * @returns CSS style string
 */
export function buildSnippetStyles(
	config: SnippetWidgetConfig,
	separator: string = '; '
): string {
	const styleParts: string[] = [];

	if (config.placeholderColor) {
		styleParts.push(`--snippet-placeholder-color: ${config.placeholderColor}`);
	}
	if (config.placeholderActiveColor) {
		styleParts.push(
			`--snippet-placeholder-active-color: ${config.placeholderActiveColor}`
		);
	}
	if (config.ghostTextColor) {
		styleParts.push(`--snippet-ghost-text-color: ${config.ghostTextColor}`);
	}
	if (config.choiceActiveColor) {
		styleParts.push(`--snippet-choice-active-color: ${config.choiceActiveColor}`);
	}
	if (config.choiceInactiveColor) {
		styleParts.push(
			`--snippet-choice-inactive-color: ${config.choiceInactiveColor}`
		);
	}

	return styleParts.join(separator);
}

/**
 * Build style attributes object for Decoration.mark
 * @param config The widget configuration
 * @returns Style attributes object or undefined if no styles
 */
export function buildSnippetStyleAttributes(
	config: SnippetWidgetConfig
): { style: string } | undefined {
	const styleString = buildSnippetStyles(config, '; ');
	return styleString ? { style: styleString } : undefined;
}

/**
 * Apply snippet styles to an HTML element
 * @param element The HTML element to apply styles to
 * @param config The widget configuration
 */
export function applySnippetStyles(
	element: HTMLElement,
	config: SnippetWidgetConfig
): void {
	const styleString = buildSnippetStyles(config, ';');
	element.style.cssText = styleString;
}

