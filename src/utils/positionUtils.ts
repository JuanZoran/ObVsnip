import type { Editor } from 'obsidian';
import type { EditorPosition } from 'obsidian';
import type { TabStopInfo } from '../types';
import type { SnippetSessionStop } from '../snippetSession';

/**
 * Convert editor position to offset
 * Provides consistent API across the codebase
 */
export function posToOffset(editor: Editor, pos: EditorPosition): number {
	return editor.posToOffset(pos);
}

/**
 * Convert offset to editor position
 * Provides consistent API across the codebase
 */
export function offsetToPos(editor: Editor, offset: number): EditorPosition {
	return editor.offsetToPos(offset);
}

/**
 * Get selection range as offsets
 * Helper function to reduce repetitive code
 */
export function getSelectionOffsets(editor: Editor): { from: number; to: number } {
	const from = editor.getCursor('from');
	const to = editor.getCursor('to');
	return {
		from: editor.posToOffset(from),
		to: editor.posToOffset(to),
	};
}

/**
 * Adjust stop positions after a text replacement
 * @param stops Array of stops to adjust
 * @param replaceStart Start position of the replacement
 * @param replaceEnd End position of the replacement (before replacement)
 * @param newLength Length of the replacement text
 * @returns Updated stops array
 */
export function adjustStopPositionsAfterReplacement(
	stops: TabStopInfo[],
	replaceStart: number,
	replaceEnd: number,
	newLength: number
): TabStopInfo[] {
	const diff = newLength - (replaceEnd - replaceStart);
	if (diff === 0) {
		return stops.map((stop) => ({ ...stop }));
	}

	const updatedStops = stops.map((stop) => ({ ...stop }));

	updatedStops.forEach((stop) => {
		const overlapsStart = stop.start >= replaceStart && stop.start <= replaceEnd;
		const overlapsEnd = stop.end >= replaceStart && stop.end <= replaceEnd;
		const wrapsReplacement = stop.start < replaceStart && stop.end > replaceEnd;
		const boundariesMatch = stop.end === replaceStart || stop.start === replaceEnd;

		if (stop.start >= replaceEnd) {
			// Stop is after the replacement - shift both start and end
			stop.start += diff;
			stop.end += diff;
		} else if (overlapsStart || overlapsEnd || wrapsReplacement || boundariesMatch) {
			// Stop overlaps or touches the replacement - adjust end only
			stop.end += diff;
		}
	});

	return updatedStops;
}

/**
 * Update information for a stop position change
 */
export interface StopPositionUpdate {
	position: number;
	diff: number;
	linkedIndex: number;
	newLength: number;
}

/**
 * Recalculate stop positions after multiple updates
 * @param updatedStops The stops array to update (will be modified)
 * @param originalStops The original stops array before updates
 * @param updateDiffs Array of update differences with position and length changes
 * @param currentStopIndex Index of the current stop being edited
 */
export function recalculateStopPositions(
	updatedStops: SnippetSessionStop[],
	originalStops: SnippetSessionStop[],
	updateDiffs: StopPositionUpdate[],
	currentStopIndex: number
): void {
	// Sort update diffs by position (ascending) to calculate cumulative adjustments
	updateDiffs.sort((a, b) => a.position - b.position);

	// First, calculate cumulative adjustments for all stops
	// This needs to be done before updating linked stops' positions
	const positionAdjustments = new Map<number, number>();
	for (let i = 0; i < updatedStops.length; i++) {
		const originalStop = originalStops[i];
		const originalStart = originalStop.start;

		// Calculate cumulative adjustment from all updates before this stop
		let cumulativeAdjustment = 0;
		for (const updateDiff of updateDiffs) {
			if (updateDiff.position < originalStart) {
				cumulativeAdjustment += updateDiff.diff;
			}
		}

		if (cumulativeAdjustment !== 0) {
			positionAdjustments.set(i, cumulativeAdjustment);
		}
	}

	// Update linked stops' positions (start and end)
	for (const updateDiff of updateDiffs) {
		const linkedStop = updatedStops[updateDiff.linkedIndex];
		const originalLinkedStop = originalStops[updateDiff.linkedIndex];
		const adjustment = positionAdjustments.get(updateDiff.linkedIndex) || 0;

		updatedStops[updateDiff.linkedIndex] = {
			...linkedStop,
			start: originalLinkedStop.start + adjustment,
			end: originalLinkedStop.start + adjustment + updateDiff.newLength,
		};
	}

	// Apply cumulative position adjustments to all stops that come after any update
	// Note: Current stop position was already updated above
	// Linked stops positions were also updated above
	// Now we need to adjust positions for stops that come after any of the updates
	for (let i = 0; i < updatedStops.length; i++) {
		const stop = updatedStops[i];
		const originalStop = originalStops[i];
		const originalStart = originalStop.start;

		// Skip stops that were updated (their positions are already set correctly above)
		const wasUpdated = updateDiffs.some((ud) => ud.linkedIndex === i);
		if (wasUpdated || i === currentStopIndex) {
			// Positions for updated stops and current stop are already correct
			continue;
		}

		// Apply adjustment if needed for stops that come after any update
		const adjustment = positionAdjustments.get(i);
		if (adjustment !== undefined && adjustment !== 0) {
			updatedStops[i] = {
				...stop,
				start: originalStart + adjustment,
				end: originalStop.end + adjustment,
			};
		}
	}
}

