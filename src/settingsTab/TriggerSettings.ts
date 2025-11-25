import { Setting } from "obsidian";
import type TextSnippetsPlugin from "../../main";

type SettingsStrings = ReturnType<TextSnippetsPlugin["getStrings"]>["settings"];

export class TriggerSettings {
	constructor(
		private plugin: TextSnippetsPlugin,
		private strings: SettingsStrings,
		private saveAndApplySettings: () => Promise<void>
	) {}

	render(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: this.strings.triggerSection });
		new Setting(containerEl)
			.setName(this.strings.triggerName)
			.setDesc(this.strings.triggerDesc)
			.addText((text) =>
				text
					.setPlaceholder("Tab")
					.setValue(this.plugin.settings.triggerKey)
					.onChange(async (value) => {
						this.plugin.settings.triggerKey = value.trim() || "Tab";
						await this.saveAndApplySettings();
					})
			);
	}
}


