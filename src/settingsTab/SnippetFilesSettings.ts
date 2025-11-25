import { App, Menu, Notice, Setting, TFile } from "obsidian";
import type TextSnippetsPlugin from "../../main";

type SettingsStrings = ReturnType<TextSnippetsPlugin["getStrings"]>["settings"];

export class SnippetFilesSettings {
	constructor(
		private plugin: TextSnippetsPlugin,
		private strings: SettingsStrings,
		private app: App,
		private refresh: () => void
	) {}

	render(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: this.strings.snippetFilesListName });
		containerEl.createEl("p", { text: this.strings.snippetFilesListDesc });
		const listWrapper = containerEl.createDiv({ cls: "snippet-files-list" });
		this.renderSnippetFileEntries(listWrapper);
		containerEl.createEl("p", {
			text: this.strings.snippetFilesOrderHint,
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName(this.strings.fileName)
			.setDesc(this.strings.fileDesc)
			.addButton((btn) =>
				btn
					.setButtonText(this.strings.snippetFilesAddButton)
					.setCta()
					.onClick((event) => this.showFileMenu(event))
			)
			.addButton((btn) =>
				btn
					.setButtonText(this.strings.snippetFilesReloadButton)
					.onClick(() => this.handleReloadSnippets())
			);
	}

	private renderSnippetFileEntries(container: HTMLElement): void {
		container.empty();
		const files = this.plugin.settings.snippetFiles;
		if (files.length === 0) {
			container.createEl("p", {
				text: this.strings.snippetFilesEmpty,
				cls: "setting-item-description",
			});
			return;
		}

		files.forEach((path, index) => {
			const row = new Setting(container).setName(`${index + 1}. ${path}`);
			row.addButton((btn) =>
				btn.setButtonText(this.strings.editButton).onClick(async () => {
					const file = this.app.vault.getAbstractFileByPath(path);
					if (!(file instanceof TFile)) {
						new Notice("File not found in vault");
						return;
					}
					await this.app.workspace.getLeaf().openFile(file);
				})
			);
			row.addButton((btn) =>
				btn
					.setButtonText(this.strings.snippetFilesRemoveButton)
					.setWarning()
					.onClick(() => this.handleRemoveSnippetFile(path))
			);
		});
	}

	private showFileMenu(event: MouseEvent | undefined): void {
		const files = this.plugin.getSnippetLoader().getTextFiles();

		if (files.length === 0) {
			new Notice("No text files found in vault");
			return;
		}

		const menu = new Menu();
		files.forEach((file: TFile) => {
			menu.addItem((item) =>
				item.setTitle(file.path).onClick(async () => {
					await this.handleSnippetFileSelected(file.path);
				})
			);
		});

		if (event) {
			menu.showAtMouseEvent(event);
			return;
		}

		// Fallback in case the mouse event is unavailable.
		menu.showAtPosition({
			x: window.innerWidth / 2,
			y: window.innerHeight / 2,
		});
	}

	private async handleSnippetFileSelected(path: string): Promise<void> {
		if (!path) return;
		if (!this.plugin.settings.snippetFiles.includes(path)) {
			this.plugin.settings.snippetFiles.push(path);
			await this.plugin.saveSettings();
			await this.plugin.loadSnippetsFromFiles();
		}
		this.refresh();
	}

	private async handleRemoveSnippetFile(path: string): Promise<void> {
		this.plugin.settings.snippetFiles = this.plugin.settings.snippetFiles.filter(
			(p) => p !== path
		);
		await this.plugin.saveSettings();
		await this.plugin.loadSnippetsFromFiles();
		this.refresh();
	}

	private async handleReloadSnippets(): Promise<void> {
		await this.plugin.loadSnippetsFromFiles();
	}
}

