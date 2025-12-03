import { App, Menu, Notice, Setting, TFile, Modal } from "obsidian";
import type TextSnippetsPlugin from "../../main";
import type { SnippetFileConfig, SnippetContextScope } from "../types";

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
			row.addButton((btn) =>
				btn
					.setButtonText(this.strings.snippetFilesContextButton)
					.onClick(() => this.openContextModal(path))
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
			this.plugin.settings.snippetFileConfigs[path] = this.getOrCreateConfig(path);
			await this.plugin.saveSettings();
			await this.plugin.loadSnippetsFromFiles();
		}
		this.refresh();
	}

	private async handleRemoveSnippetFile(path: string): Promise<void> {
		this.plugin.settings.snippetFiles = this.plugin.settings.snippetFiles.filter(
			(p) => p !== path
		);
		delete this.plugin.settings.snippetFileConfigs[path];
		await this.plugin.saveSettings();
		await this.plugin.loadSnippetsFromFiles();
		this.refresh();
	}

	private async handleReloadSnippets(): Promise<void> {
		await this.plugin.loadSnippetsFromFiles();
	}

	private getOrCreateConfig(path: string): SnippetFileConfig {
		const existing = this.plugin.settings.snippetFileConfigs[path];
		if (existing) return existing;
		const config: SnippetFileConfig = {
			path,
			enabled: true,
			contexts: [{ scope: "anywhere" }],
		};
		this.plugin.settings.snippetFileConfigs[path] = config;
		return config;
	}

	private hasScope(config: SnippetFileConfig, scope: SnippetContextScope): boolean {
		return (config.contexts ?? []).some((entry) => entry.scope === scope);
	}

	private async updateConfig(path: string, partial: Partial<SnippetFileConfig>): Promise<void> {
		const current = this.getOrCreateConfig(path);
		const next: SnippetFileConfig = {
			...current,
			...partial,
		};
		if (!next.contexts || next.contexts.length === 0) {
			next.contexts = [{ scope: "anywhere" }];
		}
		this.plugin.settings.snippetFileConfigs[path] = next;
		await this.plugin.saveSettings();
	}

	private openContextModal(path: string): void {
		const config = this.getOrCreateConfig(path);
		const modal = new SnippetContextModal(
			this.app,
			path,
			config,
			this.strings,
			async (updated) => {
				await this.updateConfig(path, updated);
				this.refresh();
			}
		);
		modal.open();
	}
}

class SnippetContextModal extends Modal {
	constructor(
		app: App,
		private path: string,
		private config: SnippetFileConfig,
		private strings: SettingsStrings,
		private onSave: (config: SnippetFileConfig) => Promise<void>
	) {
		super(app);
	}

	private hasScope(scope: SnippetContextScope): boolean {
		return (this.config.contexts ?? []).some((entry) => entry.scope === scope);
	}

	onOpen(): void {
		this.renderModal();
	}

	private renderModal(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", { text: this.strings.snippetFilesContextTitle });
		contentEl.createEl("p", {
			text: this.strings.snippetFilesContextDesc,
			cls: "setting-item-description",
		});

		const anywhereEnabled = this.hasScope("anywhere");

		new Setting(contentEl)
			.setName(this.strings.snippetFilesContextLabels?.anywhere ?? "Anywhere")
			.setDesc(anywhereEnabled ? this.strings.snippetFilesContextDesc : "")
			.addToggle((toggle) =>
				toggle
					.setValue(anywhereEnabled)
					.onChange(async (value) => {
						if (value) {
							this.config = { ...this.config, contexts: [{ scope: "anywhere" }] };
						} else {
							// 关闭任意位置时，默认落到 Markdown 以避免空配置
							this.config = {
								...this.config,
								contexts: [{ scope: "markdown" }],
							};
						}
						await this.onSave(this.config);
						this.renderModal();
					})
			);

		if (!anywhereEnabled) {
			this.renderAdvancedControls(contentEl);
		}
	}

	private renderAdvancedControls(container: HTMLElement): void {
		const scopes: Array<{ scope: SnippetContextScope; label: string }> = [
			{ scope: "markdown", label: this.strings.snippetFilesContextLabels?.markdown ?? "Markdown" },
			{ scope: "codeblock", label: this.strings.snippetFilesContextLabels?.codeblock ?? "Code block" },
			{ scope: "inline-code", label: this.strings.snippetFilesContextLabels?.["inline-code"] ?? "Inline code" },
			{ scope: "mathblock", label: this.strings.snippetFilesContextLabels?.mathblock ?? "Math block" },
			{ scope: "inline-math", label: this.strings.snippetFilesContextLabels?.["inline-math"] ?? "Inline math" },
		];

		const list = container.createDiv({ cls: "snippet-context-checkboxes" });
		for (const entry of scopes) {
			const setting = new Setting(list)
				.setName(entry.label)
				.addToggle((toggle) =>
					toggle
						.setValue(this.hasScope(entry.scope))
						.onChange(async (value) => {
							let contexts = [...(this.config.contexts ?? [])];
							const exists = contexts.some((c) => c.scope === entry.scope);
							if (value && !exists) {
								contexts.push(
									entry.scope === "codeblock"
										? { scope: entry.scope, languages: [] }
										: { scope: entry.scope }
								);
							} else if (!value) {
								contexts = contexts.filter((c) => c.scope !== entry.scope);
							}
							if (contexts.length === 0) {
								contexts.push({ scope: "markdown" });
							}
							this.config = { ...this.config, contexts };
							await this.onSave(this.config);
							this.renderModal();
						})
				);
			setting.setClass("snippet-context-toggle");
		}

		this.renderLanguagesSetting(container);
	}

	private renderLanguagesSetting(container: HTMLElement): void {
		const existing = container.querySelector(".snippet-context-langs");
		if (existing) {
			existing.remove();
		}
		if (!this.hasScope("codeblock")) {
			return;
		}
		const wrapper = container.createDiv({ cls: "snippet-context-langs" });
		const desc = this.strings.snippetFilesContextLanguages;
		new Setting(wrapper)
			.setName(desc)
			.setDesc(this.strings.snippetFilesContextLanguagesPlaceholder)
			.addText((text) => {
				const langs = this.config.contexts?.find((c) => c.scope === "codeblock")?.languages ?? [];
				text.setValue(langs.join(", "));
				text.onChange(async (value) => {
					const languages = value
						.split(",")
						.map((s) => s.trim())
						.filter((s) => s.length > 0);
					const contexts = (this.config.contexts ?? []).map((entry) =>
						entry.scope === "codeblock" ? { ...entry, languages } : entry
					);
					this.config = { ...this.config, contexts };
					await this.onSave(this.config);
				});
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
