import { Setting } from "obsidian";
import type TextSnippetsPlugin from "../../main";
import type { SnippetMenuKeymap } from "../types";

type SettingsStrings = ReturnType<TextSnippetsPlugin["getStrings"]>["settings"];

export class PickerSettings {
	constructor(
		private plugin: TextSnippetsPlugin,
		private strings: SettingsStrings,
		private saveAndApplySettings: () => Promise<void>
	) {}

	render(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: this.strings.pickerSection });
		containerEl.createEl("p", {
			text: this.strings.pickerHint,
		});

		const menuKeyConfigs: Array<{
			key: keyof SnippetMenuKeymap;
			name: string;
			desc: string;
			placeholder: string;
		}> = [
			{
				key: "next",
				name: this.strings.menuKeys.nextName,
				desc: this.strings.menuKeys.nextDesc,
				placeholder: "ArrowDown",
			},
			{
				key: "prev",
				name: this.strings.menuKeys.prevName,
				desc: this.strings.menuKeys.prevDesc,
				placeholder: "ArrowUp",
			},
			{
				key: "accept",
				name: this.strings.menuKeys.acceptName,
				desc: this.strings.menuKeys.acceptDesc,
				placeholder: "Enter",
			},
			{
				key: "toggle",
				name: this.strings.menuKeys.toggleName,
				desc: this.strings.menuKeys.toggleDesc,
				placeholder: "Mod-Shift-S",
			},
		];

		menuKeyConfigs.forEach((config) => {
			this.addMenuKeySetting(
				containerEl,
				config.key,
				config.name,
				config.desc,
				config.placeholder
			);
		});
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
						await this.saveAndApplySettings();
					})
			);
	}
}


