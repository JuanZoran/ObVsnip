import type { App, Editor } from "obsidian";
interface VariableContext {
	app: App;
	editor: Editor;
}

interface VariableResolution {
	value: string | null;
	reason?: string;
}

const pad = (value: number): string => value.toString().padStart(2, "0");

const readClipboardText = (): string | null => {
	try {
		const electron = (window as any)?.require?.("electron");
		const clipboard = electron?.clipboard;
		if (clipboard?.readText) {
			return clipboard.readText();
		}
	} catch {
		// ignore
	}
	return null;
};

/**
 * Get current date/time values in a single call to avoid multiple Date() instantiations
 */
const getCurrentDateTime = () => {
	const now = new Date();
	return {
		year: now.getFullYear(),
		month: now.getMonth() + 1,
		date: now.getDate(),
		hours: now.getHours(),
		minutes: now.getMinutes(),
		seconds: now.getSeconds(),
	};
};

/**
 * Create a cached getter function
 * @param factory Function that produces the value to cache
 * @returns A getter function that caches the result of the factory
 */
function createCachedGetter<T>(factory: () => T): () => T {
	let cached: T | undefined;
	return () => cached ??= factory();
}

export const resolveVariableValue = (
	name: string,
	context: VariableContext
): VariableResolution => {
	// Cache active file for variables that need it
	const getActiveFile = createCachedGetter(() =>
		context.app.workspace.getActiveFile()
	);

	// Cache datetime for date/time variables
	const getCachedDateTime = createCachedGetter(getCurrentDateTime);

	switch (name) {
		case "TM_FILENAME": {
			const file = getActiveFile();
			return file
				? { value: file.name }
				: { value: null, reason: "No active file" };
		}
		case "TM_FILEPATH": {
			const file = getActiveFile();
			return file
				? { value: file.path }
				: { value: null, reason: "No active file" };
		}
		case "TM_SELECTED_TEXT": {
			const selection = context.editor.getSelection();
			return selection
				? { value: selection }
				: { value: null, reason: "No selection" };
		}
		case "TM_FOLDER": {
			const file = getActiveFile();
			return file && file.parent
				? { value: file.parent.name }
				: { value: null, reason: "No parent folder" };
		}
		case "VAULT_NAME": {
			return { value: context.app.vault.getName() };
		}
		case "TM_CLIPBOARD": {
			const value = readClipboardText();
			if (value === null) {
				return { value: null, reason: "Clipboard unavailable" };
			}
			return { value };
		}
		case "CURRENT_YEAR": {
			const dt = getCachedDateTime();
			return { value: String(dt.year) };
		}
		case "CURRENT_MONTH": {
			const dt = getCachedDateTime();
			return { value: pad(dt.month) };
		}
		case "CURRENT_DATE": {
			const dt = getCachedDateTime();
			return {
				value: `${dt.year}-${pad(dt.month)}-${pad(dt.date)}`,
			};
		}
		case "CURRENT_HOUR": {
			const dt = getCachedDateTime();
			return { value: pad(dt.hours) };
		}
		case "CURRENT_MINUTE": {
			const dt = getCachedDateTime();
			return { value: pad(dt.minutes) };
		}
		case "CURRENT_SECOND": {
			const dt = getCachedDateTime();
			return { value: pad(dt.seconds) };
		}
		case "TIME_FORMATTED": {
			const dt = getCachedDateTime();
			return {
				value: `${pad(dt.hours)}:${pad(dt.minutes)}:${pad(dt.seconds)}`,
			};
		}
		default:
			return { value: null, reason: "Unknown variable" };
	}
};
