import { ChangeDesc, EditorState, Extension, RangeSetBuilder, StateEffect, StateField, Transaction } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { buildSnippetStyleAttributes } from './utils/styleUtils';
import { findStopByIndex, findNextStop, isReferenceStop } from './utils/stopUtils';
import { renderChoiceList } from './utils/choiceUtils';

export interface SnippetWidgetConfig {
	enabled: boolean;
	placeholderColor?: string;
	placeholderActiveColor?: string;
	ghostTextColor?: string;
	choiceActiveColor?: string;
	choiceInactiveColor?: string;
}

export interface SnippetSessionStop {
	index: number;
	start: number;
	end: number;
	label?: string;
	choices?: string[];
	type?: 'standard' | 'reference' | 'function';  // stop 类型
	referenceGroup?: string;  // 引用组标识
	linkedStops?: number[];  // 存储同一引用组的其他 stop 索引（在 session.stops 中的索引）
}

export interface SnippetSessionEntry {
	currentIndex: number;
	stops: SnippetSessionStop[];
}

type SnippetSessionStack = SnippetSessionEntry[];

const DEFAULT_WIDGET_CONFIG: SnippetWidgetConfig = {
	enabled: true,
};

// Debug logging for reference realtime sync (controlled by plugin settings)
let debugRealtimeSyncEnabled = false;
export const setDebugRealtimeSync = (enabled: boolean): void => {
	debugRealtimeSyncEnabled = enabled;
};

const logRealtimeDebug = (...args: unknown[]): void => {
	if (!debugRealtimeSyncEnabled) return;
	console.debug('[ReferenceRealtime]', ...args);
};

let widgetConfig: SnippetWidgetConfig = { ...DEFAULT_WIDGET_CONFIG };

// Realtime sync callback for reference stops
type RealtimeSyncCallback = (view: EditorView, session: SnippetSessionEntry, currentStop: SnippetSessionStop) => void;
let realtimeSyncCallback: RealtimeSyncCallback | null = null;

export const setRealtimeSyncCallback = (callback: RealtimeSyncCallback | null): void => {
	realtimeSyncCallback = callback;
};

export const getRealtimeSyncCallback = (): RealtimeSyncCallback | null => realtimeSyncCallback;

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
export const replaceSnippetSessionEffect = StateEffect.define<SnippetSessionEntry>();
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
			} else if (effect.is(replaceSnippetSessionEffect)) {
				if (current.length === 0) continue;
				current = [
					...current.slice(0, -1),
					effect.value,
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
		private readonly highlightColor?: string,
		private readonly inactiveColor?: string
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
		if (this.inactiveColor) {
			wrapper.style.setProperty(
				"--snippet-choice-inactive-color",
				this.inactiveColor
			);
		}

		const iconEl = document.createElement('span');
		iconEl.className = 'snippet-choice-hint-icon';
		iconEl.textContent = this.hint;
		wrapper.appendChild(iconEl);

		const listEl = document.createElement('span');
		listEl.className = 'snippet-choice-hint-list';

		renderChoiceList(listEl, this.choices, {
			activeChoice: this.activeChoice,
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
		const isEmpty = stop.start === stop.end;

		// Skip empty stops unless they're active
		if (isEmpty && !isActive) {
			continue;
		}

		// Skip active stops that don't match selection
		if (
			isActive &&
			(selection.from !== stop.start || selection.to !== stop.end)
		) {
			continue;
		}

		const className = isActive ? 'cm-snippet-placeholder-active' : 'cm-snippet-placeholder';
		const attributes = buildSnippetStyleAttributes(widgetConfig);

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
						widgetConfig.choiceActiveColor,
						widgetConfig.choiceInactiveColor
					),
				});
				pending.push({
					from: stop.end,
					to: stop.end,
					deco: hintWidget,
				});
			}
	}

	const nextStopCandidate = findNextStop(session, session.currentIndex);
	const nextStop = nextStopCandidate ?? undefined;

	if (nextStop) {
	const widget = Decoration.widget({
		side: 1,
		widget: new NextTabStopWidget(
			nextStop.label ?? `$${nextStop.index}`,
			widgetConfig.ghostTextColor ?? widgetConfig.placeholderActiveColor
		),
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
		private lastDocLength: number = 0;
		private lastSelection: { from: number; to: number } | null = null;

		constructor(view: EditorView) {
			this.decorations = buildDecorations(view.state);
			this.lastDocLength = view.state.doc.length;
			this.lastSelection = view.state.selection.main;
		}

		update(update: ViewUpdate) {
			const docChanged = update.docChanged;
			const selectionChanged = update.selectionSet;
			const sessionChanged = update.startState.field(snippetSessionField) !== update.state.field(snippetSessionField);
			// Detect structural session changes (push/pop/replace/clear) so realtime sync only skips when session stack itself is modified
			const sessionChangedByEffect = update.transactions.some(tr =>
				tr.effects.some(effect =>
					effect.is(pushSnippetSessionEffect) ||
					effect.is(popSnippetSessionEffect) ||
					effect.is(replaceSnippetSessionEffect) ||
					effect.is(clearSnippetSessionsEffect)
				)
			);

			if (docChanged || selectionChanged || sessionChanged) {
				this.decorations = buildDecorations(update.state);
			}

			// Handle realtime sync for reference stops
			if (docChanged && realtimeSyncCallback && !sessionChangedByEffect) {
				// Skip if this change was triggered by snippet sync (avoid infinite loop)
				const isSnippetSync = update.transactions.some(tr => 
					tr.annotation(Transaction.userEvent) === 'snippet-sync'
				);
				if (isSnippetSync) {
					logRealtimeDebug('Skip realtime sync (snippet-sync transaction)');
					return;
				}
				
				// Only sync if session didn't change structurally (to avoid syncing during session push/pop)
				const stack = update.state.field(snippetSessionField);
				if (!stack || stack.length === 0) {
					logRealtimeDebug('Skip realtime sync (no session stack)');
					return;
				}

				const session = stack[stack.length - 1];
				if (session.currentIndex < 0) {
					logRealtimeDebug('Skip realtime sync (invalid currentIndex)', session.currentIndex);
					return;
				}

				const selection = update.state.selection.main;

				// Find the reference stop that the cursor is currently inside (for duplicate indices, use range match)
				const currentStop = session.stops.find((stop) =>
					isReferenceStop(stop) &&
					stop.index === session.currentIndex &&
					selection.from >= stop.start &&
					selection.from <= stop.end
				);

				if (!currentStop) {
					logRealtimeDebug('Skip realtime sync (no reference stop matching selection)', {
						currentIndex: session.currentIndex,
						selection: { from: selection.from, to: selection.to },
					});
					return;
				}

				const changes = update.changes;
				let changeInCurrentStop = false;

				// Check whether any change range overlaps the current stop (using new positions)
				changes.iterChanges((_fromA, _toA, fromB, toB) => {
					const overlaps = fromB <= currentStop.end && toB >= currentStop.start;
					if (overlaps) {
						changeInCurrentStop = true;
					}
				});

				// Also allow trigger when selection is inside the stop even if change range was zero-length at boundary
				if (!changeInCurrentStop && selection.from >= currentStop.start && selection.from <= currentStop.end) {
					changeInCurrentStop = true;
				}

				if (changeInCurrentStop && realtimeSyncCallback) {
					logRealtimeDebug('Trigger realtime sync', {
						currentIndex: currentStop.index,
						selection: { from: selection.from, to: selection.to },
						stopRange: { start: currentStop.start, end: currentStop.end },
						changeDesc: changes.toString(),
					});
					// Dispatching view updates during a ViewPlugin.update causes nested update errors.
					// Defer the sync to the next task so CodeMirror completes the current update cycle first.
					const callback = realtimeSyncCallback;
					setTimeout(() => {
						if (!callback) return;
						logRealtimeDebug('Execute deferred realtime sync', {
							currentIndex: currentStop.index,
							selection: { from: selection.from, to: selection.to },
							stopRange: { start: currentStop.start, end: currentStop.end },
						});
						callback(update.view, session, currentStop);
					}, 0);
				} else {
					logRealtimeDebug('Skip realtime sync (no overlap with current reference stop)', {
						currentIndex: currentStop.index,
						selection: { from: selection.from, to: selection.to },
						stopRange: { start: currentStop.start, end: currentStop.end },
						changeDesc: changes.toString(),
					});
				}
			}

			if (selectionChanged) {
				this.lastSelection = update.state.selection.main;
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

export const getSnippetWidgetConfig = (): SnippetWidgetConfig => ({
	...widgetConfig,
});

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
