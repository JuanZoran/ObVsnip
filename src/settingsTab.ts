import { App, Menu, Notice, PluginSettingTab, Setting, TFile } from 'obsidian';
import type TextSnippetsPlugin from '../main';
import type { SnippetMenuKeymap } from './types';

export class TextSnippetsSettingsTab extends PluginSettingTab {
	private plugin: TextSnippetsPlugin;

	constructor(app: App, plugin: TextSnippetsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Text Snippets Settings" });
		containerEl.createEl("p", {
			text: "Uses VSCode-style JSON snippet format",
		});

		this.createFileSelectionSetting();
		this.createSettingsSection();
	}

	private createFileSelectionSetting(): void {
		const { containerEl } = this;

		new Setting(containerEl)
			.setName("Snippets file")
			.setDesc("Select a JSON file containing VSCode-style snippets")
			.addText((text) =>
				text
					.setPlaceholder("snippets.json")
					.setValue(this.plugin.settings.snippetsFilePath)
					.setDisabled(true)
			)
			.addButton((btn) =>
				btn
					.setButtonText("Choose file")
					.setCta()
					.onClick(() => this.showFileMenu())
			)
			.addButton((btn) =>
				btn.setButtonText("Edit").onClick(async () => {
					if (!this.plugin.settings.snippetsFilePath) {
						new Notice("Please select a snippet file first");
						return;
					}
					await this.openFileInEditor();
				})
			);
	}

	private createSettingsSection(): void {
		const { containerEl } = this;
		containerEl.createEl('h3', { text: 'Snippet trigger' });

		new Setting(containerEl)
			.setName('Trigger key')
			.setDesc('Key combination (CodeMirror syntax) used for expand/jump fallback, e.g. "Tab" or "Mod-Enter".')
			.addText(text =>
				text
					.setPlaceholder('Tab')
					.setValue(this.plugin.settings.triggerKey)
					.onChange(async value => {
						this.plugin.settings.triggerKey = value.trim() || 'Tab';
						await this.plugin.saveSettings();
						this.plugin.applyRuntimeSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Show menu when trigger has no match')
			.setDesc('When enabled, pressing the trigger key with no matching prefix opens the snippet menu so you can pick manually.')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.autoShowMenu)
					.onChange(async value => {
						this.plugin.settings.autoShowMenu = value;
						await this.plugin.saveSettings();
					}),
			);

		containerEl.createEl('h3', { text: 'Snippet picker' });
		containerEl.createEl('p', {
			text: 'Customize keyboard shortcuts for the inline picker. Leave fields blank to use Obsidian defaults.',
		});
		this.addMenuKeySetting(containerEl, 'next', 'Next item', 'Move the selection down.', 'ArrowDown');
		this.addMenuKeySetting(containerEl, 'prev', 'Previous item', 'Move the selection up.', 'ArrowUp');
		this.addMenuKeySetting(containerEl, 'accept', 'Accept selection', 'Insert the highlighted snippet.', 'Enter');
		this.addMenuKeySetting(containerEl, 'toggle', 'Toggle picker', 'Open or close the picker anywhere.', 'Mod-Shift-S');

		containerEl.createEl("h3", { text: "Virtual text" });

		new Setting(containerEl)
			.setName("Show tab stop hints")
			.setDesc(
				"Display a ghost-text preview at the next snippet tab stop."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showVirtualText)
					.onChange(async (value) => {
						this.plugin.settings.showVirtualText = value;
						await this.plugin.saveSettings();
						this.plugin.applyRuntimeSettings();
					})
			);

		containerEl.createEl("h3", { text: "Debugging" });

		new Setting(containerEl)
			.setName("Enable debug mode")
			.setDesc(
				"Controls whether the plugin prints diagnostic information to the developer console."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableDebugLogs)
					.onChange(async (value) => {
						this.plugin.settings.enableDebugLogs = value;
						await this.plugin.saveSettings();
						this.plugin.applyRuntimeSettings();
					})
			);
	}

	private showFileMenu(): void {
		const files = this.plugin.getSnippetLoader().getTextFiles();

		if (files.length === 0) {
			new Notice("No text files found in vault");
			return;
		}

		const menu = new Menu();
		files.forEach((file: TFile) => {
			menu.addItem((item) =>
				item.setTitle(file.path).onClick(async () => {
					this.plugin.settings.snippetsFilePath = file.path;
					await this.plugin.saveSettings();
					await this.plugin.loadSnippetsFromFile();
					this.display();
				})
			);
		});

		menu.showAtMouseEvent(event as MouseEvent);
	}

	private async openFileInEditor(): Promise<void> {
		const filePath = this.plugin.settings.snippetsFilePath;
		if (!filePath) return;

		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file && file.hasOwnProperty("stat")) {
			await this.app.workspace.getLeaf().openFile(file as TFile);
		}
	}

	private addMenuKeySetting(
		containerEl: HTMLElement,
		key: keyof SnippetMenuKeymap,
		label: string,
		desc: string,
		placeholder: string
	): void {
		new Setting(containerEl)
			.setName(label)
			.setDesc(desc)
			.addText((text) =>
				text
					.setPlaceholder(placeholder)
					.setValue(this.plugin.settings.menuKeymap[key] || "")
					.onChange(async (value) => {
						this.plugin.settings.menuKeymap[key] = value.trim();
						await this.plugin.saveSettings();
						this.plugin.applyRuntimeSettings();
					})
			);
	}
}
