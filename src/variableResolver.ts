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

export const resolveVariableValue = (
	name: string,
	context: VariableContext
): VariableResolution => {
	switch (name) {
		case "TM_FILENAME": {
			const file = context.app.workspace.getActiveFile();
			return file
				? { value: file.name }
				: { value: null, reason: "No active file" };
		}
		case "TM_FILEPATH": {
			const file = context.app.workspace.getActiveFile();
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
			const file = context.app.workspace.getActiveFile();
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
			const now = new Date();
			return { value: String(now.getFullYear()) };
		}
		case "CURRENT_MONTH": {
			const now = new Date();
			return { value: pad(now.getMonth() + 1) };
		}
		case "CURRENT_DATE": {
			const now = new Date();
			return {
				value: `${now.getFullYear()}-${pad(
					now.getMonth() + 1
				)}-${pad(now.getDate())}`,
			};
		}
		case "CURRENT_HOUR": {
			const now = new Date();
			return { value: pad(now.getHours()) };
		}
		case "CURRENT_MINUTE": {
			const now = new Date();
			return { value: pad(now.getMinutes()) };
		}
		case "CURRENT_SECOND": {
			const now = new Date();
			return { value: pad(now.getSeconds()) };
		}
		case "TIME_FORMATTED": {
			const now = new Date();
			return {
				value: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
					now.getSeconds()
				)}`,
			};
		}
		default:
			return { value: null, reason: "Unknown variable" };
	}
};
