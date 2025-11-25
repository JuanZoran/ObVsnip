export const __noticeMessages: string[] = [];

export class Notice {
	constructor(public message: string) {
		__noticeMessages.push(message);
	}
}

export class TFile {
	path = '';
	extension = 'json';
}

export class Menu {
	addItem() {
		return this;
	}
	showAtMouseEvent() {
		return this;
	}
	showAtPosition() {
		return this;
	}
}

export class Modal {
	constructor(public app: any) {}
	open() {}
	close() {}
}

export class Setting {
	constructor(public container: HTMLElement) {}
	setName() {
		return this;
	}
	setDesc() {
		return this;
	}
	addText() {
		return this;
	}
	addButton() {
		return this;
	}
	addToggle() {
		return this;
	}
	addDropdown() {
		return this;
	}
	setWarning() {
		return this;
	}
}

export class PluginSettingTab {
	containerEl: HTMLElement = document.createElement('div');
	constructor(public app: any, public plugin: any) {}
}

export class MarkdownView {}

export const editorEditorField = {};

export class App {
	vault = {
		getName: () => 'vault',
		getFiles: () => [],
		getAbstractFileByPath: () => null,
	} as any;
	workspace = {
		getActiveViewOfType: () => null,
		getLeavesOfType: () => [],
		onLayoutReady: (cb: () => void) => cb(),
	};
}

export class Editor {
	getCursor() {
		return { line: 0, ch: 0 };
	}
	getLine() {
		return '';
	}
	getSelection() {
		return '';
	}
	setCursor() {}
	setSelection() {}
	replaceRange() {}
	getRange() {
		return '';
	}
	posToOffset() {
		return 0;
	}
	offsetToPos() {
		return { line: 0, ch: 0 };
	}
}

export class Plugin {
	app: any;
	manifest: any;
	constructor(app: any, manifest: any) {
		this.app = app;
		this.manifest = manifest;
	}
	onload() {}
	onunload() {}
	loadData() {
		return Promise.resolve({});
	}
	saveData() {
		return Promise.resolve();
	}
	addSettingTab() {}
	registerCommands() {}
	registerEditorExtension() {}
	registerEvent() {}
	register() {}
}
