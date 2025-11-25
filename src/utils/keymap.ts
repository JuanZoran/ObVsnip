import { Prec, type Extension } from '@codemirror/state';
import { keymap, type EditorView } from '@codemirror/view';
import type { SnippetMenuKeymap } from '../types';

interface TriggerKeymapConfig {
	triggerKey: string;
	menuKeymap?: SnippetMenuKeymap;
	handleTrigger: (view: EditorView) => boolean;
	handleToggle: (view: EditorView) => boolean;
	forceExitSnippetMode: (view: EditorView) => boolean;
	menuHandlers?: {
		next?: (view: EditorView) => boolean;
		prev?: (view: EditorView) => boolean;
		accept?: (view: EditorView) => boolean;
	};
}

export const buildTriggerKeymapExtension = (config: TriggerKeymapConfig): Extension => {
	const bindings: { key: string; run: (view: EditorView) => boolean }[] = [];
	const triggerKey = config.triggerKey?.trim() || 'Tab';

	if (triggerKey) {
		bindings.push({
			key: triggerKey,
			run: (view: EditorView) => config.handleTrigger(view),
		});
	}

	const toggleKey = config.menuKeymap?.toggle?.trim();
	if (toggleKey) {
		bindings.push({
			key: toggleKey,
			run: (view: EditorView) => config.handleToggle(view),
		});
	}

	const addMenuBinding = (key: string | undefined, handler: ((view: EditorView) => boolean) | undefined) => {
		if (!key || !handler) return;
		bindings.push({
			key,
			run: view => handler(view),
		});
	};

	addMenuBinding(config.menuKeymap?.next?.trim(), config.menuHandlers?.next);
	addMenuBinding(config.menuKeymap?.prev?.trim(), config.menuHandlers?.prev);
	addMenuBinding(config.menuKeymap?.accept?.trim(), config.menuHandlers?.accept);

	const exitHandler = (view: EditorView): boolean => config.forceExitSnippetMode(view);

	bindings.push({ key: 'Escape', run: exitHandler });
	bindings.push({ key: 'Ctrl-[', run: exitHandler });

	return Prec.highest(keymap.of(bindings));
};
