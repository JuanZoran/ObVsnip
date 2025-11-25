import type { SnippetSessionEntry, SnippetSessionStop } from '../snippetSession';
import type { TabStopInfo } from '../types';

/**
 * Find a stop by its index in a session
 */
export function findStopByIndex(
	session: SnippetSessionEntry,
	index: number
): SnippetSessionStop | undefined {
	return session.stops.find((stop) => stop.index === index);
}

/**
 * Find all stops of a specific type in a session
 */
export function findStopsByType(
	session: SnippetSessionEntry,
	type: SnippetSessionStop['type']
): SnippetSessionStop[] {
	return session.stops.filter((stop) => stop.type === type);
}

/**
 * Check if a stop is a reference type
 */
export function isReferenceStop(stop: SnippetSessionStop): boolean {
	return stop.type === 'reference';
}

/**
 * Check if a stop is a standard type (default when type is undefined)
 */
export function isStandardStop(stop: SnippetSessionStop): boolean {
	return !stop.type || stop.type === 'standard';
}

/**
 * Check if a stop has choices
 */
export function hasChoices(stop: SnippetSessionStop): boolean {
	return !!(stop.choices && stop.choices.length > 0);
}

/**
 * Get the current stop from a session
 */
export function getCurrentStop(session: SnippetSessionEntry): SnippetSessionStop | undefined {
	return findStopByIndex(session, session.currentIndex);
}

/**
 * Find the next stop after the current index
 */
export function findNextStop(
	session: SnippetSessionEntry,
	currentIndex: number
): SnippetSessionStop | undefined {
	let nextIndex = currentIndex + 1;
	let nextStop = findStopByIndex(session, nextIndex);

	// If no next stop found and not at $0, try to jump to $0
	if (!nextStop && currentIndex !== 0) {
		nextIndex = 0;
		nextStop = findStopByIndex(session, 0);
	}

	return nextStop;
}

/**
 * Find the previous stop before the current index
 */
export function findPrevStop(
	session: SnippetSessionEntry,
	currentIndex: number
): SnippetSessionStop | undefined {
	const prevIndex = currentIndex - 1;
	return findStopByIndex(session, prevIndex);
}

/**
 * Convert TabStopInfo array to SnippetSessionStop array with base offset
 * @param tabStops Array of TabStopInfo to convert
 * @param baseOffset Base offset to add to stop positions
 * @returns Sorted array of SnippetSessionStop
 */
export function convertTabStopsToSessionStops(
	tabStops: TabStopInfo[],
	baseOffset: number
): SnippetSessionStop[] {
	return tabStops
		.map((stop) => ({
			index: stop.index,
			start: baseOffset + stop.start,
			end: baseOffset + stop.end,
			choices: stop.choices,
			type: stop.type,
			referenceGroup: stop.referenceGroup,
		}))
		.sort((a, b) => {
			if (a.start !== b.start) return a.start - b.start;
			if (a.end !== b.end) return a.end - b.end;
			return a.index - b.index;
		});
}

/**
 * Build linkedStops relationships for reference-type stops
 * Modifies the stops array in place by setting linkedStops for each reference stop
 * @param stops Array of SnippetSessionStop to process
 * @returns Summary string of reference groups, or null if no reference stops found
 */
export function buildReferenceStopLinks(stops: SnippetSessionStop[]): string | null {
	if (!stops.some((stop) => isReferenceStop(stop))) {
		return null;
	}

	const referenceGroups = new Map<string, number[]>();
	stops.forEach((stop, idx) => {
		if (isReferenceStop(stop) && stop.referenceGroup) {
			const group = referenceGroups.get(stop.referenceGroup);
			if (group) {
				group.push(idx);
			} else {
				referenceGroups.set(stop.referenceGroup, [idx]);
			}
		}
	});

	// 为每个引用 stop 设置 linkedStops
	referenceGroups.forEach((indices) => {
		indices.forEach((idx) => {
			stops[idx].linkedStops = indices.filter(i => i !== idx);
		});
	});

	const referenceSummary = Array.from(referenceGroups.entries())
		.map(([group, indices]) => `group ${group}: ${indices.length} stops`)
		.join(", ");

	return referenceSummary;
}

