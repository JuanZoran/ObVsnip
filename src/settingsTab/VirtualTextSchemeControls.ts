import { Notice, Setting } from "obsidian";
import type TextSnippetsPlugin from "../../main";
import type { VirtualTextColorPreset } from "../types";

type SettingsStrings = ReturnType<TextSnippetsPlugin["getStrings"]>["settings"];

export class VirtualTextSchemeControls {
	private newColorSchemeName = "";
	private selectedPresetName: string | null = null;

	constructor(
		private plugin: TextSnippetsPlugin,
		private strings: SettingsStrings,
		private updatePreview: () => void,
		private refresh: () => void
	) {}

	render(containerEl: HTMLElement): void {
		const presets = this.plugin.getVirtualTextColorPresets();
		this.selectedPresetName =
			this.plugin.getSelectedVirtualTextPresetName() ||
			this.selectedPresetName;

		new Setting(containerEl)
			.setName(this.strings.virtualPreviewSchemeSelectName)
			.setDesc(this.strings.virtualPreviewSchemeSelectDesc)
			.addDropdown((dropdown) => {
				dropdown.addOption("", this.strings.virtualPreviewSchemeSelectDefault);
				for (const preset of presets) {
					if (!preset.name) continue;
					dropdown.addOption(preset.name, preset.name);
				}
				dropdown.setValue(this.selectedPresetName ?? "");
				dropdown.onChange(async (value) => {
					this.selectedPresetName = value || null;
					if (!value) return;
					const preset = presets.find((entry) => entry.name === value);
					if (!preset) return;
					this.plugin.applyVirtualTextColorPreset(preset);
					await this.plugin.saveSettings();
					this.updatePreview();
					this.refresh();
				});
			});

		new Setting(containerEl)
			.setName(this.strings.virtualPreviewSchemeNameInputName)
			.setDesc(this.strings.virtualPreviewSchemeNameInputDesc)
			.addText((text) => {
				text
					.setPlaceholder(
						this.strings.virtualPreviewSchemeNameInputPlaceholder
					)
					.setValue(this.newColorSchemeName)
					.onChange((value) => {
						this.newColorSchemeName = value;
					});
			})
			.addButton((btn) =>
				btn
					.setButtonText(this.strings.virtualPreviewSaveScheme)
					.setCta()
					.onClick(() => void this.saveColorScheme())
			);

		new Setting(containerEl)
			.setName(this.strings.virtualPreviewImportScheme)
			.setDesc(this.strings.virtualPreviewImportSchemeDesc)
			.addButton((btn) =>
				btn
					.setButtonText(this.strings.virtualPreviewImportScheme)
					.onClick(() => void this.importColorSchemeFromPrompt())
			);
	}

	private buildColorPreset(name: string): VirtualTextColorPreset {
		return {
			name,
			placeholderColor: this.plugin.settings.virtualTextColor,
			placeholderActiveColor: this.plugin.settings.placeholderActiveColor,
			ghostTextColor: this.plugin.settings.ghostTextColor,
			choiceActiveColor: this.plugin.settings.choiceHighlightColor,
			choiceInactiveColor: this.plugin.settings.choiceInactiveColor,
		};
	}

	private isValidColorPreset(data: unknown): data is VirtualTextColorPreset {
		if (typeof data !== "object" || !data) return false;
		const cast = data as Record<string, unknown>;
		return (
			typeof cast.placeholderColor === "string" &&
			typeof cast.placeholderActiveColor === "string" &&
			typeof cast.ghostTextColor === "string" &&
			typeof cast.choiceActiveColor === "string" &&
			typeof cast.choiceInactiveColor === "string"
		);
	}

	public async saveColorScheme(nameOverride?: string): Promise<void> {
		const name = (nameOverride ?? this.newColorSchemeName).trim();
		if (!name) {
			new Notice(this.strings.virtualPreviewSchemeNameRequired);
			return;
		}
		this.plugin.saveVirtualTextColorPreset(this.buildColorPreset(name));
		this.selectedPresetName = name;
		await this.plugin.saveSettings();
		new Notice(this.strings.virtualPreviewSchemeSaved);
		this.newColorSchemeName = "";
		this.refresh();
	}

	public async importColorScheme(raw?: string | null): Promise<void> {
		if (!raw) return;
		try {
			const parsed = JSON.parse(raw);
			if (!this.isValidColorPreset(parsed)) {
				throw new Error("invalid preset");
			}
			const importedName =
				((parsed as VirtualTextColorPreset).name ?? "").trim() ||
				this.strings.virtualPreviewImportedName;
			this.plugin.applyVirtualTextColorPreset({
				...parsed,
				name: importedName,
			});
			await this.plugin.saveSettings();
			this.updatePreview();
			new Notice(this.strings.virtualPreviewImportSuccess);
			this.selectedPresetName = importedName;
			this.refresh();
		} catch {
			new Notice(this.strings.virtualPreviewImportFailed);
		}
	}

	public async importColorSchemeFromPrompt(): Promise<void> {
		if (
			typeof window === "undefined" ||
			typeof window.prompt !== "function"
		) {
			new Notice(this.strings.virtualPreviewImportUnsupported);
			return;
		}
		const raw = window.prompt(this.strings.virtualPreviewImportPrompt);
		await this.importColorScheme(raw);
	}
}

