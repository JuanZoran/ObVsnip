import { Setting } from "obsidian";
import type TextSnippetsPlugin from "../../main";

type SettingsStrings = ReturnType<TextSnippetsPlugin["getStrings"]>["settings"];

export class ReferenceSnippetSettings {
	constructor(
		private plugin: TextSnippetsPlugin,
		private strings: SettingsStrings,
		private saveAndApplySettings: () => Promise<void>
	) {}

	render(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: this.strings.referenceSection });
		containerEl.createEl("p", {
			text: this.strings.referenceSectionDesc,
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName(this.strings.referenceEnabledName)
			.setDesc(this.strings.referenceEnabledDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.referenceSnippetEnabled)
					.onChange(async (value) => {
						this.plugin.settings.referenceSnippetEnabled = value;
						await this.saveAndApplySettings();
					})
			);

		new Setting(containerEl)
			.setName(this.strings.referenceSyncModeName)
			.setDesc(this.strings.referenceSyncModeDesc)
			.addDropdown((dropdown) => {
				dropdown
					.addOption("realtime", this.strings.referenceSyncModeRealtime)
					.addOption("on-jump", this.strings.referenceSyncModeOnJump)
					.setValue(this.plugin.settings.referenceSyncMode)
					.onChange(async (value: "realtime" | "on-jump") => {
						this.plugin.settings.referenceSyncMode = value;
						await this.saveAndApplySettings();
					});
			});
	}
}


