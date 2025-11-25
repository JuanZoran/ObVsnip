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

// Debounce state for realtime sync
interface PendingSync {
	timeoutId: number;
	view: EditorView;
	session: SnippetSessionEntry;
	currentStop: SnippetSessionStop;
	syncId: number;
}

let pendingSync: PendingSync | null = null;
let syncIdCounter = 0;
const DEBOUNCE_DELAY_MS = 50; // Debounce rapid changes

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

/**
 * Check if session was changed by an effect (push/pop/replace/clear)
 */
function isSessionChangedByEffect(update: ViewUpdate): boolean {
	return update.transactions.some(tr =>
		tr.effects.some(effect =>
			effect.is(pushSnippetSessionEffect) ||
			effect.is(popSnippetSessionEffect) ||
			effect.is(replaceSnippetSessionEffect) ||
			effect.is(clearSnippetSessionsEffect)
		)
	);
}

/**
 * Check if this update was triggered by a snippet sync operation
 */
function isSnippetSyncTransaction(update: ViewUpdate): boolean {
	return update.transactions.some(tr => 
		tr.annotation(Transaction.userEvent) === 'snippet-sync'
	);
}

/**
 * Find the current reference stop that matches the selection
 */
function findCurrentReferenceStop(
	session: SnippetSessionEntry,
	selection: { from: number; to: number }
): SnippetSessionStop | null {
	return session.stops.find((stop) =>
		isReferenceStop(stop) &&
		stop.index === session.currentIndex &&
		selection.from >= stop.start &&
		selection.from <= stop.end
	) ?? null;
}

/**
 * Check if changes overlap with the current stop
 * Simplified to check selection position since we know the document changed
 */
function hasChangesInStop(
	_changes: ChangeDesc,
	currentStop: SnippetSessionStop,
	selection: { from: number; to: number }
): boolean {
	// Check if selection/cursor is within the stop range
	// This is sufficient since we already know the document changed
	const selectionInStop =
		selection.from >= currentStop.start && selection.from <= currentStop.end;

	// Also check if selection extends into or through the stop
	const selectionOverlapsStop =
		selection.to > currentStop.start && selection.from <= currentStop.end;

	return selectionInStop || selectionOverlapsStop;
}

/**
 * Check if realtime sync should be triggered for this update
 */
function shouldTriggerRealtimeSync(
	update: ViewUpdate,
	session: SnippetSessionEntry
): { shouldSync: boolean; currentStop: SnippetSessionStop | null; reason?: string } {
	// Early return checks
	if (!update.docChanged) {
		return { shouldSync: false, currentStop: null, reason: 'no document change' };
	}

	if (!realtimeSyncCallback) {
		return { shouldSync: false, currentStop: null, reason: 'no callback registered' };
	}

	if (isSessionChangedByEffect(update)) {
		return { shouldSync: false, currentStop: null, reason: 'session changed by effect' };
	}

	if (isSnippetSyncTransaction(update)) {
		logRealtimeDebug('Skip realtime sync (snippet-sync transaction)');
		return { shouldSync: false, currentStop: null, reason: 'snippet-sync transaction' };
	}

	if (session.currentIndex < 0) {
		logRealtimeDebug('Skip realtime sync (invalid currentIndex)', session.currentIndex);
		return { shouldSync: false, currentStop: null, reason: 'invalid currentIndex' };
	}

	const selection = update.state.selection.main;
	const currentStop = findCurrentReferenceStop(session, selection);

	if (!currentStop) {
		logRealtimeDebug('Skip realtime sync (no reference stop matching selection)', {
			currentIndex: session.currentIndex,
			selection: { from: selection.from, to: selection.to },
		});
		return { shouldSync: false, currentStop: null, reason: 'no matching reference stop' };
	}

	// Check if changes are within the current stop
	const changeInStop = hasChangesInStop(update.changes, currentStop, selection);

	if (!changeInStop) {
		logRealtimeDebug('Skip realtime sync (no overlap with current reference stop)', {
			currentIndex: currentStop.index,
			selection: { from: selection.from, to: selection.to },
			stopRange: { start: currentStop.start, end: currentStop.end },
			changeDesc: update.changes.toString(),
		});
		return { shouldSync: false, currentStop, reason: 'no overlap with stop' };
	}

	return { shouldSync: true, currentStop };
}

/**
 * Validate that the session and stop are still valid before syncing
 */
function validateSyncState(
	view: EditorView,
	session: SnippetSessionEntry,
	currentStop: SnippetSessionStop
): boolean {
	// Check if callback is still registered
	if (!realtimeSyncCallback) {
		logRealtimeDebug('Skip sync: callback not registered');
		return false;
	}

	// Get current session state from view
	const currentStack = view.state.field(snippetSessionField);
	if (!currentStack || currentStack.length === 0) {
		logRealtimeDebug('Skip sync: no active session');
		return false;
	}

	const latestSession = currentStack[currentStack.length - 1];
	
	// Check if session is still the same (same stops array reference or same structure)
	// We compare by checking if the current index and stop structure match
	if (
		latestSession.currentIndex !== session.currentIndex ||
		latestSession.stops.length !== session.stops.length
	) {
		logRealtimeDebug('Skip sync: session changed', {
			oldIndex: session.currentIndex,
			newIndex: latestSession.currentIndex,
			oldStops: session.stops.length,
			newStops: latestSession.stops.length,
		});
		return false;
	}

	// Verify the current stop still exists and matches
	const matchingStop = latestSession.stops.find(
		(stop) =>
			stop.index === currentStop.index &&
			isReferenceStop(stop) &&
			stop.referenceGroup === currentStop.referenceGroup
	);

	if (!matchingStop) {
		logRealtimeDebug('Skip sync: current stop no longer exists', {
			index: currentStop.index,
			referenceGroup: currentStop.referenceGroup,
		});
		return false;
	}

	// Check if selection is still within the stop range
	const selection = view.state.selection.main;
	if (
		selection.from < matchingStop.start ||
		selection.from > matchingStop.end
	) {
		logRealtimeDebug('Skip sync: selection moved outside stop', {
			selectionFrom: selection.from,
			stopRange: { start: matchingStop.start, end: matchingStop.end },
		});
		return false;
	}

	return true;
}

/**
 * Execute realtime sync callback with debouncing and validation
 */
function executeRealtimeSync(
	view: EditorView,
	session: SnippetSessionEntry,
	currentStop: SnippetSessionStop
): void {
	if (!realtimeSyncCallback) return;

	// Cancel any pending sync for this view
	if (pendingSync && pendingSync.view === view) {
		clearTimeout(pendingSync.timeoutId);
		logRealtimeDebug('Cancelled pending sync', { syncId: pendingSync.syncId });
	}

	// Create new sync operation
	const syncId = ++syncIdCounter;
	const capturedSession = { ...session, stops: session.stops.map(s => ({ ...s })) };
	const capturedStop = { ...currentStop };

	logRealtimeDebug('Schedule realtime sync', {
		syncId,
		currentIndex: currentStop.index,
		selection: view.state.selection.main,
		stopRange: { start: currentStop.start, end: currentStop.end },
	});

	// Debounce rapid changes
	const timeoutId = window.setTimeout(() => {
		// Clear pending sync
		if (pendingSync?.syncId === syncId) {
			pendingSync = null;
		}

		// Validate state before executing
		if (!validateSyncState(view, capturedSession, capturedStop)) {
			logRealtimeDebug('Sync cancelled: validation failed', { syncId });
			return;
		}

		// Get latest session state for callback
		const currentStack = view.state.field(snippetSessionField);
		if (!currentStack || currentStack.length === 0) {
			logRealtimeDebug('Sync cancelled: no session', { syncId });
			return;
		}

		const latestSession = currentStack[currentStack.length - 1];
		const latestStop = latestSession.stops.find(
			(stop) =>
				stop.index === capturedStop.index &&
				isReferenceStop(stop) &&
				stop.referenceGroup === capturedStop.referenceGroup
		);

		if (!latestStop) {
			logRealtimeDebug('Sync cancelled: stop not found', { syncId });
			return;
		}

		// Execute callback with latest state
		logRealtimeDebug('Execute realtime sync', {
			syncId,
			currentIndex: latestStop.index,
			selection: view.state.selection.main,
			stopRange: { start: latestStop.start, end: latestStop.end },
		});

		const callback = realtimeSyncCallback;
		if (callback) {
			callback(view, latestSession, latestStop);
		}
	}, DEBOUNCE_DELAY_MS);

	pendingSync = {
		timeoutId,
		view,
		session: capturedSession,
		currentStop: capturedStop,
		syncId,
	};
}

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

			// Update decorations if needed
			if (docChanged || selectionChanged || sessionChanged) {
				this.decorations = buildDecorations(update.state);
			}

			// Handle realtime sync for reference stops
			if (docChanged && realtimeSyncCallback) {
				const stack = update.state.field(snippetSessionField);
				if (!stack || stack.length === 0) {
					return;
				}

				const session = stack[stack.length - 1];
				const syncResult = shouldTriggerRealtimeSync(update, session);

				if (syncResult.shouldSync && syncResult.currentStop) {
					executeRealtimeSync(update.view, session, syncResult.currentStop);
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
