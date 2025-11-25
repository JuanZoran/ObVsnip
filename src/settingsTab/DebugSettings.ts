import { Setting } from "obsidian";
import type TextSnippetsPlugin from "../../main";
import type { DebugCategory } from "../logger";
import { BUILTIN_VARIABLES } from "../snippetBody";
import { VariableHelpModal } from "./VariableHelpModal";

type SettingsStrings = ReturnType<TextSnippetsPlugin["getStrings"]>["settings"];

const DEBUG_CATEGORY_KEYS: DebugCategory[] = [
	"general",
	"loader",
	"parser",
	"manager",
	"menu",
	"session",
];

export class DebugSettings {
	constructor(
		private plugin: TextSnippetsPlugin,
		private strings: SettingsStrings,
		private saveAndApplySettings: () => Promise<void>
	) {}

	render(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: this.strings.debugSection });

		const modulesWrapper = containerEl.createDiv();
		this.renderDebugModuleSettings(modulesWrapper);
		this.toggleDebugModuleControls(
			modulesWrapper,
			this.plugin.settings.enableDebugLogs
		);

		new Setting(containerEl)
			.setName(this.strings.debugName)
			.setDesc(this.strings.debugDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableDebugLogs)
					.onChange(async (value) => {
						this.plugin.settings.enableDebugLogs = value;
						await this.saveAndApplySettings();
						this.toggleDebugModuleControls(modulesWrapper, value);
					})
			);

		new Setting(containerEl)
			.setName(this.strings.variableHelpName)
			.setDesc(this.strings.variableHelpDesc)
			.addButton((btn) =>
				btn.setButtonText("ℹ️").onClick(() => this.showVariableHelp())
			);
	}

	private renderDebugModuleSettings(containerEl: HTMLElement): void {
		containerEl.addClass("debug-modules-wrapper");
		new Setting(containerEl)
			.setName(this.strings.debugCategoriesName)
			.setDesc(this.strings.debugCategoriesDesc);

		const categoryLabels = this.strings.debugCategoryOptions;
		DEBUG_CATEGORY_KEYS.forEach((key) => {
			const debugRow = new Setting(containerEl)
				.setName(categoryLabels[key])
				.addToggle((toggle) =>
					toggle
						.setValue(
							this.plugin.settings.debugCategories.includes(key)
						)
						.onChange(async (value) => {
							const categories = new Set(
								this.plugin.settings.debugCategories
							);
							if (value) {
								categories.add(key);
							} else {
								categories.delete(key);
							}
							this.plugin.settings.debugCategories = Array.from(
								categories
							);
							await this.saveAndApplySettings();
						})
				);
			const rowEl = debugRow.settingEl;
			if (rowEl) {
				rowEl.addClass("debug-module-item");
			}
		});
	}

	private toggleDebugModuleControls(
		container: HTMLElement,
		enabled: boolean
	): void {
		container.style.display = enabled ? "" : "none";
	}

	private showVariableHelp(): void {
		const detailMap = this.strings.variableDetails;
		const entries = Array.from(BUILTIN_VARIABLES)
			.sort()
			.map((name) => ({
				name,
				detail: detailMap[name] ?? "",
			}));
		const modal = new VariableHelpModal(
			this.plugin.app,
			this.strings.variableHelpName,
			this.strings.variableHelpDesc,
			entries
		);
		modal.open();
	}
}


