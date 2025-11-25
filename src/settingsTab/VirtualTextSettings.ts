import { Setting } from "obsidian";
import type TextSnippetsPlugin from "../../main";
import { processSnippetBody } from "../snippetBody";
import { VirtualTextSchemeControls } from "./VirtualTextSchemeControls";

type SettingsStrings = ReturnType<TextSnippetsPlugin["getStrings"]>["settings"];

interface VirtualPreviewSnippetData {
	beforeText: string;
	placeholderText: string;
	afterText: string;
	choices: string[];
}

export class VirtualTextSettings {
	private virtualPreviewSnippet: HTMLElement | null = null;

	constructor(
		private plugin: TextSnippetsPlugin,
		private strings: SettingsStrings,
		private saveAndApplySettings: () => Promise<void>,
		private refresh: () => void
	) {}

	render(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: this.strings.virtualSection });

		new Setting(containerEl)
			.setName(this.strings.showHintsName)
			.setDesc(this.strings.showHintsDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showVirtualText)
					.onChange(async (value) => {
						this.plugin.settings.showVirtualText = value;
						await this.saveAndApplySettings();
					})
			);

		const controls = new VirtualTextSchemeControls(
			this.plugin,
			this.strings,
			() => this.updateVirtualPreviewStyles(),
			this.refresh
		);
		controls.render(containerEl);

		const colorConfigs: Array<{
			name: string;
			desc: string;
			getValue: () => string;
			setValue: (value: string) => void;
			requiresPreviewUpdate?: boolean;
		}> = [
			{
				name: this.strings.placeholderColorName,
				desc: this.strings.placeholderColorDesc,
				getValue: () => this.plugin.settings.virtualTextColor,
				setValue: (value) => {
					this.plugin.settings.virtualTextColor = value;
				},
				requiresPreviewUpdate: true,
			},
			{
				name: this.strings.choiceHighlightName,
				desc: this.strings.choiceHighlightDesc,
				getValue: () => this.plugin.settings.choiceHighlightColor,
				setValue: (value) => {
					this.plugin.settings.choiceHighlightColor = value;
				},
				requiresPreviewUpdate: true,
			},
			{
				name: this.strings.choiceInactiveName,
				desc: this.strings.choiceInactiveDesc,
				getValue: () => this.plugin.settings.choiceInactiveColor,
				setValue: (value) => {
					this.plugin.settings.choiceInactiveColor = value;
				},
				requiresPreviewUpdate: true,
			},
			{
				name: this.strings.placeholderActiveName,
				desc: this.strings.placeholderActiveDesc,
				getValue: () => this.plugin.settings.placeholderActiveColor,
				setValue: (value) => {
					this.plugin.settings.placeholderActiveColor = value;
				},
				requiresPreviewUpdate: true,
			},
			{
				name: this.strings.ghostTextName,
				desc: this.strings.ghostTextDesc,
				getValue: () => this.plugin.settings.ghostTextColor,
				setValue: (value) => {
					this.plugin.settings.ghostTextColor = value;
				},
				requiresPreviewUpdate: true,
			},
		];

		colorConfigs.forEach((config) => {
			this.addColorSetting(
				containerEl,
				config.name,
				config.desc,
				config.getValue(),
				async (newValue) => {
					config.setValue(newValue || "");
					await this.saveAndApplySettings();
					if (config.requiresPreviewUpdate) {
						this.updateVirtualPreviewStyles();
					}
				}
			);
		});

		this.renderVirtualTextPreview(containerEl);
	}

	private addColorSetting(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		value: string,
		onChange: (value: string) => Promise<void>
	): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((text) => {
				text
					.setPlaceholder("#000000")
					.setValue(value)
					.onChange(onChange);
				text.inputEl.setAttribute("type", "color");
			});
	}

	private updateVirtualPreviewStyles(): void {
		if (!this.virtualPreviewSnippet) return;
		const vars = [
			`--snippet-placeholder-color: ${this.plugin.settings.virtualTextColor}`,
			`--snippet-placeholder-active-color: ${this.plugin.settings.placeholderActiveColor}`,
			`--snippet-ghost-text-color: ${this.plugin.settings.ghostTextColor}`,
			`--snippet-choice-active-color: ${this.plugin.settings.choiceHighlightColor}`,
			`--snippet-choice-inactive-color: ${this.plugin.settings.choiceInactiveColor}`,
		];
		this.virtualPreviewSnippet.style.cssText = vars.join(";");
	}

	private renderVirtualTextPreview(containerEl: HTMLElement): void {
		const wrapper = containerEl.createDiv({ cls: "virtual-text-preview" });
		wrapper.createEl("div", {
			text: this.strings.virtualPreviewTitle,
			cls: "virtual-preview-title",
		});
		wrapper.createEl("div", {
			text: this.strings.virtualPreviewDesc,
			cls: "virtual-preview-desc",
		});
		const previewData = this.getVirtualPreviewSnippetData();
		const snippet = wrapper.createDiv({ cls: "virtual-preview-snippet" });
		const previewLine = snippet.createSpan({ cls: "preview-snippet-line" });
		if (previewData.beforeText) {
			previewLine.createSpan({
				cls: "preview-snippet-line-text",
				text: previewData.beforeText,
			});
		}
		previewLine.createSpan({
			cls: "preview-placeholder",
			text:
				previewData.placeholderText ||
				this.strings.virtualPreviewSamplePlaceholder,
		});
		if (previewData.afterText) {
			previewLine.createSpan({
				cls: "preview-snippet-line-text",
				text: previewData.afterText,
			});
		}
		const choices = snippet.createSpan({
			cls: "preview-choice-list",
		});
		const sampleChoices =
			previewData.choices.length > 0
				? previewData.choices
				: this.strings.virtualPreviewSampleChoices;
		sampleChoices.forEach((choice, index) => {
			const entry = choices.createSpan({
				cls: "snippet-choice-entry",
				text: choice,
			});
			if (index === sampleChoices.length - 1) {
				entry.classList.add("snippet-choice-entry-active");
			}
			if (index < sampleChoices.length - 1) {
				choices.appendChild(document.createTextNode("/"));
			}
		});
		const ghostTextSpan = snippet.createSpan({
			cls: "preview-ghost-text",
			text: this.strings.virtualPreviewSampleGreeting,
		});
		snippet.appendChild(ghostTextSpan);
		this.virtualPreviewSnippet = snippet;
		this.updateVirtualPreviewStyles();
	}

	private getVirtualPreviewSnippetData(): VirtualPreviewSnippetData {
		const fallback: VirtualPreviewSnippetData = {
			beforeText: "",
			placeholderText: this.strings.virtualPreviewSamplePlaceholder,
			afterText: "",
			choices: this.strings.virtualPreviewSampleChoices,
		};
		const sample = this.strings.virtualPreviewSampleSnippet;
		if (!sample) {
			return fallback;
		}
		try {
			const processed = processSnippetBody(sample);
			const placeholderStop = processed.tabStops.find(
				(stop) => stop.index === 1
			);
			const beforeText = placeholderStop
				? processed.text.slice(0, placeholderStop.start)
				: processed.text;
			const placeholderText = placeholderStop
				? processed.text.slice(placeholderStop.start, placeholderStop.end)
				: fallback.placeholderText;
			const afterText = placeholderStop
				? processed.text.slice(placeholderStop.end)
				: "";
			const choiceStop = processed.tabStops.find(
				(stop) => Array.isArray(stop.choices) && stop.choices.length > 0
			);
			const choices = choiceStop?.choices ?? fallback.choices;
			return {
				beforeText,
				placeholderText,
				afterText,
				choices,
			};
		} catch {
			return fallback;
		}
	}
}

