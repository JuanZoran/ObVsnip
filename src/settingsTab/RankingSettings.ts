import { Setting } from "obsidian";
import type TextSnippetsPlugin from "../../main";
import type { RankingAlgorithmId, RankingAlgorithmSetting } from "../types";
import {
	moveEnabledAlgorithm,
	normalizeRankingAlgorithms,
	toggleAlgorithmEnabled,
} from "../rankingConfig";
import { rankSnippets } from "../snippetRankingPipeline";

type SettingsStrings = ReturnType<TextSnippetsPlugin["getStrings"]>["settings"];

export class RankingSettings {
	private rankingListWrapper: HTMLElement | null = null;
	private draggedAlgorithmId: RankingAlgorithmId | null = null;

	constructor(
		private plugin: TextSnippetsPlugin,
		private strings: SettingsStrings
	) {}

	render(containerEl: HTMLElement): void {
		this.renderRankingAlgorithmSettings(containerEl);
		this.renderRankingPreview(containerEl);
	}

	private renderRankingAlgorithmSettings(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: this.strings.rankingSection });
		containerEl.createEl("p", {
			text: this.strings.rankingSectionDesc,
			cls: "setting-item-description",
		});
		containerEl.createEl("p", {
			text: this.strings.rankingStableNote,
			cls: "setting-item-description",
		});
		this.rankingListWrapper = containerEl.createDiv({
			cls: "ranking-algorithms-list",
		});
		this.renderRankingAlgorithmRows();
	}

	private renderRankingAlgorithmRows(): void {
		if (!this.rankingListWrapper) return;
		this.rankingListWrapper.empty();
		const normalized = normalizeRankingAlgorithms(
			this.plugin.settings.rankingAlgorithms
		);
		this.plugin.settings.rankingAlgorithms = normalized;
		const enabledCount = normalized.filter((entry) => entry.enabled).length;
		for (const entry of normalized) {
			this.renderRankingAlgorithmRow(entry, enabledCount);
		}
	}

	private renderRankingPreview(containerEl: HTMLElement): void {
		const wrapper = document.createElement("div");
		wrapper.className = "ranking-preview-panel";
		containerEl.appendChild(wrapper);
		const titleEl = document.createElement("h4");
		titleEl.textContent = this.strings.rankingPreviewTitle;
		wrapper.appendChild(titleEl);
		const descEl = document.createElement("p");
		descEl.className = "setting-item-description";
		descEl.textContent = this.strings.rankingPreviewDesc;
		wrapper.appendChild(descEl);

		const snippets = this.plugin.getAvailableSnippets();
		if (snippets.length === 0) {
			wrapper.createDiv({
				cls: "ranking-preview-empty",
				text: this.strings.rankingPreviewEmpty,
			});
			return;
		}

		const usage = this.plugin.getSnippetUsageCounts();
		const ranked = rankSnippets(
			snippets,
			this.plugin.settings.rankingAlgorithms,
			{ usage }
		);
		const previewList = document.createElement("div");
		previewList.className = "ranking-preview-list";
		wrapper.appendChild(previewList);
		ranked.slice(0, 3).forEach((snippet) => {
			const entry = document.createElement("div");
			entry.className = "ranking-preview-entry";
			const prefixEl = document.createElement("span");
			prefixEl.className = "ranking-preview-entry-prefix";
			prefixEl.textContent = snippet.prefix;
			const usageEl = document.createElement("span");
			usageEl.className = "ranking-preview-entry-usage";
			usageEl.textContent = `${this.strings.rankingPreviewEntryUsage}: ${
				usage.get(snippet.prefix) ?? 0
			}`;
			entry.appendChild(prefixEl);
			entry.appendChild(usageEl);
			previewList.appendChild(entry);
		});
	}

	private renderRankingAlgorithmRow(
		entry: RankingAlgorithmSetting,
		enabledCount: number
	): void {
		const row = new Setting(this.rankingListWrapper!)
			.setName(this.strings.rankingAlgorithmNames[entry.id])
			.setDesc(
				entry.enabled
					? this.strings.rankingAlgorithmEnabledDesc
					: this.strings.rankingAlgorithmDisabledDesc
			)
			.addToggle((toggle) => {
				toggle
					.setValue(entry.enabled)
					.setDisabled(entry.enabled && enabledCount <= 1)
					.onChange(async (value) => {
						this.plugin.settings.rankingAlgorithms =
							toggleAlgorithmEnabled(
								this.plugin.settings.rankingAlgorithms,
								entry.id,
								value
							);
						await this.plugin.saveSettings();
						this.renderRankingAlgorithmRows();
					});
			});

		const rowEl = row.settingEl;
		rowEl.setAttr("draggable", entry.enabled ? "true" : "false");
		rowEl.setAttr("data-algo-id", entry.id);
		rowEl.setAttr("data-enabled", entry.enabled ? "true" : "false");
		rowEl.addClass("ranking-algo-item");
		if (!entry.enabled) {
			rowEl.addClass("ranking-algo-disabled");
		}

		rowEl.addEventListener("dragstart", (event) =>
			this.handleRankingDragStart(event, entry)
		);
		rowEl.addEventListener("dragover", (event) =>
			this.handleRankingDragOver(event, entry)
		);
		rowEl.addEventListener("drop", (event) =>
			this.handleRankingDrop(event, entry)
		);
		rowEl.addEventListener("dragend", () =>
			this.handleRankingDragEnd()
		);

		const handle = rowEl.createSpan({
			cls: "ranking-algo-handle",
			text: "⋮⋮",
		});
		rowEl.insertBefore(handle, rowEl.firstChild);
	}

	private handleRankingDragStart(
		event: DragEvent,
		algorithm: RankingAlgorithmSetting
	): void {
		if (!algorithm.enabled) {
			event.preventDefault();
			return;
		}
		this.draggedAlgorithmId = algorithm.id;
		event.dataTransfer?.setData("text/plain", algorithm.id);
		event.dataTransfer?.setDragImage(new Image(), 0, 0);
	}

	private handleRankingDragOver(
		event: DragEvent,
		algorithm: RankingAlgorithmSetting
	): void {
		if (
			!this.draggedAlgorithmId ||
			!algorithm.enabled ||
			this.draggedAlgorithmId === algorithm.id
		) {
			return;
		}
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = "move";
		}
	}

	private handleRankingDrop(
		event: DragEvent,
		target: RankingAlgorithmSetting
	): void {
		event.preventDefault();
		if (
			!this.draggedAlgorithmId ||
			!target.enabled ||
			this.draggedAlgorithmId === target.id
		) {
			return;
		}
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const insertAfter =
			event.clientY > rect.top + rect.height / 2;
		void this.applyRankingReorder(
			this.draggedAlgorithmId,
			target.id,
			insertAfter
		);
		this.draggedAlgorithmId = null;
	}

	private handleRankingDragEnd(): void {
		this.draggedAlgorithmId = null;
	}

	private async applyRankingReorder(
		sourceId: RankingAlgorithmId,
		targetId: RankingAlgorithmId,
		insertAfter: boolean
	): Promise<void> {
		this.plugin.settings.rankingAlgorithms = moveEnabledAlgorithm(
			this.plugin.settings.rankingAlgorithms,
			sourceId,
			targetId,
			insertAfter
		);
		await this.plugin.saveSettings();
		this.renderRankingAlgorithmRows();
	}
}


