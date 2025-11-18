import { ChangeDesc, EditorState, Extension, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';

export interface SnippetWidgetConfig {
	enabled: boolean;
	color: string;
	choiceColor?: string;
}

export interface SnippetSessionStop {
	index: number;
	start: number;
	end: number;
	label?: string;
	choices?: string[];
}

export interface SnippetSessionEntry {
	currentIndex: number;
	stops: SnippetSessionStop[];
}

type SnippetSessionStack = SnippetSessionEntry[];

const DEFAULT_WIDGET_CONFIG: SnippetWidgetConfig = {
	enabled: true,
	color: '',
	choiceColor: '',
};

let widgetConfig: SnippetWidgetConfig = { ...DEFAULT_WIDGET_CONFIG };

const mapStops = (stops: SnippetSessionStop[], change: ChangeDesc): SnippetSessionStop[] =>
	stops.map(stop => ({
		...stop,
		start: change.mapPos(stop.start, -1),
		end: change.mapPos(stop.end, 1),
	}));

const mapStack = (stack: SnippetSessionStack, change: ChangeDesc): SnippetSessionStack =>
	stack.map(entry => ({
		...entry,
		stops: mapStops(entry.stops, change),
	}));

export const pushSnippetSessionEffect = StateEffect.define<SnippetSessionEntry>();
export const popSnippetSessionEffect = StateEffect.define<void>();
export const updateSnippetSessionEffect = StateEffect.define<{ currentIndex: number }>();
export const clearSnippetSessionsEffect = StateEffect.define<void>();

export const snippetSessionField = StateField.define<SnippetSessionStack>({
	create: () => [],
	update(value, tr) {
		let current = value;

		if (tr.docChanged) {
			current = mapStack(current, tr.changes);
		}

		for (const effect of tr.effects) {
			if (effect.is(pushSnippetSessionEffect)) {
				current = [...current, effect.value];
			} else if (effect.is(popSnippetSessionEffect)) {
				current = current.slice(0, -1);
			} else if (effect.is(updateSnippetSessionEffect)) {
				if (current.length === 0) continue;
				const updated = current[current.length - 1];
				current = [
					...current.slice(0, -1),
					{ ...updated, currentIndex: effect.value.currentIndex },
				];
			} else if (effect.is(clearSnippetSessionsEffect)) {
				current = [];
			}
		}

		return current;
	},
});

class NextTabStopWidget extends WidgetType {
	constructor(private readonly label: string, private readonly color?: string) {
		super();
	}

	toDOM(): HTMLElement {
		const span = document.createElement('span');
		span.className = 'snippet-next-placeholder';
		if (this.color) {
			span.style.color = this.color;
		}
		span.textContent = this.label;
		return span;
	}

	ignoreEvent(): boolean {
		return true;
	}
}

export class ChoiceHintWidget extends WidgetType {
	constructor(
		private readonly hint: string,
		private readonly choices: string[],
		private readonly activeChoice?: string,
		private readonly highlightColor?: string
	) {
		super();
	}

	toDOM(): HTMLElement {
		const wrapper = document.createElement('span');
		wrapper.className = 'snippet-choice-hint';
		if (this.highlightColor) {
			wrapper.style.setProperty(
				"--snippet-choice-active-color",
				this.highlightColor
			);
		}

		const iconEl = document.createElement('span');
		iconEl.className = 'snippet-choice-hint-icon';
		iconEl.textContent = this.hint;
		wrapper.appendChild(iconEl);

		const listEl = document.createElement('span');
		listEl.className = 'snippet-choice-hint-list';

		this.choices.forEach((choice, index) => {
			const choiceEl = document.createElement('span');
			choiceEl.className = 'snippet-choice-entry';
			choiceEl.textContent = choice;
			if (choice === this.activeChoice) {
				choiceEl.classList.add('snippet-choice-entry-active');
			}
			listEl.appendChild(choiceEl);
			if (index < this.choices.length - 1) {
				listEl.appendChild(document.createTextNode('/'));
			}
		});

		wrapper.appendChild(listEl);
		return wrapper;
	}

	ignoreEvent(): boolean {
		return true;
	}
}

const buildDecorations = (state: EditorState): DecorationSet => {
	if (!widgetConfig.enabled) {
		return Decoration.none;
	}

	const stack = state.field(snippetSessionField);
	if (stack.length === 0) {
		return Decoration.none;
	}

	const session = stack[stack.length - 1];
	if (session.currentIndex < 0) {
		return Decoration.none;
	}

	const builder = new RangeSetBuilder<Decoration>();
	const selection = state.selection.main;
	const pending: Array<{ from: number; to: number; deco: Decoration }> = [];

	for (const stop of session.stops) {
		if (stop.index === 0) {
			continue;
		}

		if (stop.index < session.currentIndex) {
			continue;
		}

		const isActive = stop.index === session.currentIndex;

		if (stop.start === stop.end && !isActive) {
			continue;
		}

		if (
			isActive &&
			(selection.from !== stop.start || selection.to !== stop.end)
		) {
			continue;
		}

		if (stop.start === stop.end) {
			continue;
		}

		const className = isActive ? 'cm-snippet-placeholder-active' : 'cm-snippet-placeholder';
		const attributes = widgetConfig.color ? { style: `--snippet-placeholder-color: ${widgetConfig.color}` } : undefined;

		pending.push({
			from: stop.start,
			to: stop.end,
			deco: Decoration.mark({
				class: className,
				attributes,
			}),
		});

			if (isActive && stop.choices && stop.choices.length > 0) {
				const activeChoice = state.doc.sliceString(stop.start, stop.end);
				const hintWidget = Decoration.widget({
					side: 1,
					widget: new ChoiceHintWidget(
						'⚙️',
						stop.choices,
						activeChoice,
						widgetConfig.choiceColor ??
							widgetConfig.color ??
							undefined
					),
				});
				pending.push({
					from: stop.end,
					to: stop.end,
					deco: hintWidget,
				});
			}
	}

	let nextStop =
		session.stops.find((stop: SnippetSessionStop) => stop.index === session.currentIndex + 1) ??
		(session.currentIndex !== 0
			? session.stops.find((stop: SnippetSessionStop) => stop.index === 0)
			: undefined);

	if (nextStop) {
		const widget = Decoration.widget({
			side: 1,
			widget: new NextTabStopWidget(nextStop.label ?? `$${nextStop.index}`, widgetConfig.color),
		});
		pending.push({
			from: nextStop.end,
			to: nextStop.end,
			deco: widget,
		});
	}

	pending
		.sort((a, b) => {
			if (a.from !== b.from) return a.from - b.from;
			if (a.to !== b.to) return a.to - b.to;
			return 0;
		})
		.forEach((entry) => builder.add(entry.from, entry.to, entry.deco));

	return builder.finish();
};

export const snippetSessionPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = buildDecorations(view.state);
		}

		update(update: ViewUpdate) {
			if (
				update.docChanged ||
				update.selectionSet ||
				update.startState.field(snippetSessionField) !== update.state.field(snippetSessionField)
			) {
				this.decorations = buildDecorations(update.state);
			}
		}
	},
	{
		decorations: value => value.decorations,
	},
);

export const snippetSessionExtensions: Extension[] = [snippetSessionField, snippetSessionPlugin];

export const setSnippetWidgetConfig = (config: Partial<SnippetWidgetConfig>): void => {
	widgetConfig = { ...widgetConfig, ...config };
};

export const getSnippetSessionStack = (view?: EditorView): SnippetSessionEntry[] | null => {
	if (!view) return null;
	try {
		return view.state.field(snippetSessionField);
	} catch {
		return null;
	}
};

export const isSnippetSessionActive = (view?: EditorView): boolean => {
	const stack = getSnippetSessionStack(view);
	return !!stack && stack.length > 0;
};
