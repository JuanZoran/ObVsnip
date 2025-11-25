import { App, PluginSettingTab } from "obsidian";
import type TextSnippetsPlugin from "../main";
import { VirtualTextSchemeControls } from "./settingsTab/VirtualTextSchemeControls";
import { RankingSettings } from "./settingsTab/RankingSettings";
import { VirtualTextSettings } from "./settingsTab/VirtualTextSettings";
import { DebugSettings } from "./settingsTab/DebugSettings";
import { SnippetFilesSettings } from "./settingsTab/SnippetFilesSettings";
import { TriggerSettings } from "./settingsTab/TriggerSettings";
import { PickerSettings } from "./settingsTab/PickerSettings";
import { ReferenceSnippetSettings } from "./settingsTab/ReferenceSnippetSettings";

// Re-export for tests
export { VirtualTextSchemeControls };
export { RankingSettings } from "./settingsTab/RankingSettings";
export { DebugSettings } from "./settingsTab/DebugSettings";

export class TextSnippetsSettingsTab extends PluginSettingTab {
	private plugin: TextSnippetsPlugin;

	constructor(app: App, plugin: TextSnippetsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * Helper method to save settings and apply runtime changes
	 * Reduces code duplication across settings handlers
	 */
	private async saveAndApplySettings(): Promise<void> {
		await this.plugin.saveSettings();
		this.plugin.applyRuntimeSettings();
	}

	display(): void {
		const { containerEl } = this;
		const strings = this.plugin.getStrings().settings;
		containerEl.empty();
		containerEl.createEl("h2", { text: strings.title });

		// File selection settings
		const snippetFilesSettings = new SnippetFilesSettings(
			this.plugin,
			strings,
			this.app,
			() => this.display()
		);
		snippetFilesSettings.render(containerEl);

		// Trigger settings
		const triggerSettings = new TriggerSettings(
			this.plugin,
			strings,
			() => this.saveAndApplySettings()
		);
		triggerSettings.render(containerEl);

		// Picker settings
		const pickerSettings = new PickerSettings(
			this.plugin,
			strings,
			() => this.saveAndApplySettings()
		);
		pickerSettings.render(containerEl);

		// Reference snippet settings
		const referenceSettings = new ReferenceSnippetSettings(
			this.plugin,
			strings,
			() => this.saveAndApplySettings()
		);
		referenceSettings.render(containerEl);

		// Ranking settings
		const rankingSettings = new RankingSettings(this.plugin, strings);
		rankingSettings.render(containerEl);

		// Virtual text settings
		const virtualTextSettings = new VirtualTextSettings(
			this.plugin,
			strings,
			() => this.saveAndApplySettings(),
			() => this.display()
		);
		virtualTextSettings.render(containerEl);

		// Debug settings
		const debugSettings = new DebugSettings(
			this.plugin,
			strings,
			() => this.saveAndApplySettings()
		);
		debugSettings.render(containerEl);
	}
}
