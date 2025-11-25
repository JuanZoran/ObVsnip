import type { EditorView } from "@codemirror/view";
import { Transaction } from "@codemirror/state";
import type { Editor } from "obsidian";
import { getEditorView } from "./editorUtils";
import { recalculateStopPositions } from "./positionUtils";
import { isReferenceStop } from "./stopUtils";
import type { SnippetSessionStop, SnippetSessionEntry } from "../snippetSession";
import type { PluginLogger } from "../logger";

/**
 * Service for synchronizing reference tab stops
 */
export class ReferenceSyncService {
	private isSyncing = false;
	private syncOperationId = 0;

	constructor(private logger: PluginLogger) {}

	/**
	 * Calculate the actual text range for a stop, accounting for user input that may extend beyond stop.end
	 */
	calculateActualTextRange(
		currentStop: SnippetSessionStop,
		view: EditorView
	): { actualStart: number; actualEnd: number; text: string } {
		const selection = view.state.selection.main;
		const actualStart = currentStop.start;

		// When user is typing, the cursor/selection indicates where the actual text ends
		// Use selection end if it extends into or beyond the stop, otherwise use stop.end
		const selectionEnd =
			selection.from >= currentStop.start || selection.to > currentStop.start
				? selection.to
				: currentStop.end;
		const actualEnd = Math.min(
			Math.max(selectionEnd, currentStop.end),
			view.state.doc.length
		);

		// Read actual text from CodeMirror document state (more accurate than editor.getRange)
		const text = view.state.doc.sliceString(actualStart, actualEnd);

		return { actualStart, actualEnd, text };
	}

	/**
	 * Sync reference stops - update all linked stops with the content of the current stop
	 * Returns updated stops array with corrected positions after sync
	 */
	syncReferenceStops(
		editor: Editor,
		currentStop: SnippetSessionStop,
		session: SnippetSessionEntry,
		mode: "realtime" | "on-jump"
	): SnippetSessionStop[] | null {
		if (!isReferenceStop(currentStop) || !currentStop.linkedStops) {
			return null;
		}

		// Prevent concurrent sync operations
		if (this.isSyncing) {
			this.logger.debug(
				"manager",
				`⏸️ Skip sync: operation already in progress (mode: ${mode})`
			);
			return null;
		}

		const view = getEditorView(editor);
		if (!view) return null;

		// Mark sync as in progress
		this.isSyncing = true;
		const operationId = ++this.syncOperationId;

		try {
			return this.performSync(view, editor, currentStop, session, mode, operationId);
		} finally {
			// Clear sync flag after a short delay to allow transaction to complete
			// This prevents immediate re-entry but allows legitimate subsequent syncs
			setTimeout(() => {
				if (this.syncOperationId === operationId) {
					this.isSyncing = false;
				}
			}, 10);
		}
	}

	/**
	 * Internal method to perform the actual sync operation
	 */
	private performSync(
		view: EditorView,
		editor: Editor,
		currentStop: SnippetSessionStop,
		session: SnippetSessionEntry,
		mode: "realtime" | "on-jump",
		operationId: number
	): SnippetSessionStop[] | null {

		// Calculate the actual text range for the current stop
		const { actualStart, actualEnd, text: currentText } =
			this.calculateActualTextRange(currentStop, view);

		// Find current stop index in session.stops
		// Use index and referenceGroup to find the correct stop, as positions may have changed
		const currentStopIndex = session.stops.findIndex(
			(stop) =>
				stop.index === currentStop.index &&
				isReferenceStop(stop) &&
				stop.referenceGroup === currentStop.referenceGroup &&
				stop.start === currentStop.start
		);

		// Collect updates for linked stops that differ from current text
		const updates: Array<{
			from: number;
			to: number;
			text: string;
			linkedIndex: number;
		}> = [];
		
		// TypeScript: we already checked linkedStops exists in syncReferenceStops
		if (!currentStop.linkedStops) {
			return null;
		}
		
		for (const linkedIndex of currentStop.linkedStops) {
			const linkedStop = session.stops[linkedIndex];
			if (!linkedStop || !isReferenceStop(linkedStop)) {
				continue;
			}

			const linkedText = view.state.doc.sliceString(
				linkedStop.start,
				linkedStop.end
			);
			if (linkedText !== currentText) {
				updates.push({
					from: linkedStop.start,
					to: linkedStop.end,
					text: currentText,
					linkedIndex,
				});
			}
		}

		// Create updated stops array
		const updatedStops = session.stops.map((stop) => ({ ...stop }));

		// Update current stop's end position to reflect actual text length
		if (currentStopIndex >= 0) {
			const actualTextEnd = actualStart + currentText.length;
			updatedStops[currentStopIndex] = {
				...updatedStops[currentStopIndex],
				start: actualStart,
				end: actualTextEnd,
			};
		}

		if (updates.length === 0) {
			// No changes to linked stops, but return updated stops if current stop position was corrected
			return currentStopIndex >= 0 &&
				updatedStops[currentStopIndex].end !==
					currentStop.start + currentText.length
				? updatedStops
				: null;
		}

		// Sort updates from end to start to preserve positions when applying
		updates.sort((a, b) => b.from - a.from);

		// Calculate length differences and build changes array
		const updateDiffs = updates.map((update) => ({
			position: update.from,
			diff: update.text.length - (update.to - update.from),
			linkedIndex: update.linkedIndex,
			newLength: update.text.length,
		}));

		const changes = updates.map((update) => ({
			from: update.from,
			to: update.to,
			insert: update.text,
		}));

		// Dispatch transaction with all changes atomically
		view.dispatch({
			changes,
			annotations: [Transaction.userEvent.of("snippet-sync")],
		});

		// Recalculate positions for all stops after text updates
		recalculateStopPositions(
			updatedStops,
			session.stops,
			updateDiffs,
			currentStopIndex
		);

		this.logger.debug(
			"manager",
			`🔄 Synced ${updates.length} reference stops (mode: ${mode}, op: ${operationId})`
		);
		return updatedStops;
	}
}

