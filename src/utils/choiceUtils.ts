/**
 * Utility functions for rendering choice lists
 * Reduces duplication between ChoiceHintWidget and formatSnippetPreview
 */

export interface ChoiceRenderOptions {
	containerClassName?: string;
	entryClassName?: string;
	activeClassName?: string;
	separator?: string;
	activeIndex?: number;
	activeChoice?: string;
}

/**
 * Render a list of choices into a container element
 * @param container The container element to append choices to
 * @param choices Array of choice strings
 * @param options Rendering options
 */
export function renderChoiceList(
	container: HTMLElement,
	choices: string[],
	options: ChoiceRenderOptions = {}
): void {
	const {
		entryClassName = 'snippet-choice-entry',
		activeClassName = 'snippet-choice-entry-active',
		separator = '/',
		activeIndex,
		activeChoice,
	} = options;

	choices.forEach((choice, index) => {
		const choiceEl = document.createElement('span');
		choiceEl.className = entryClassName;
		choiceEl.textContent = choice;

		// Determine if this choice is active
		const isActive =
			activeIndex !== undefined
				? index === activeIndex
				: activeChoice !== undefined
					? choice === activeChoice
					: index === 0; // Default to first choice

		if (isActive) {
			choiceEl.classList.add(activeClassName);
		}

		container.appendChild(choiceEl);

		// Add separator between choices (not after last)
		if (index < choices.length - 1 && separator) {
			container.appendChild(document.createTextNode(separator));
		}
	});
}

