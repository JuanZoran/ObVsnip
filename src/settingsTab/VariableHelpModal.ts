import { App, Modal } from "obsidian";

export class VariableHelpModal extends Modal {
	constructor(
		app: App,
		private titleText: string,
		private description: string,
		private entries: Array<{ name: string; detail: string }>
	) {
		super(app);
	}

	onOpen(): void {
		this.contentEl.empty();
		this.contentEl.addClass("variable-help-modal");
		this.contentEl.setAttr(
			"style",
			"max-height:60vh;overflow:auto;padding:12px 18px;"
		);

		this.contentEl.createEl("h2", { text: this.titleText });
		this.contentEl.createEl("p", { text: this.description });

		const list = this.contentEl.createDiv({ cls: "variable-help-list" });
		for (const entry of this.entries) {
			const row = list.createDiv({ cls: "variable-help-row" });
			row.setAttr(
				"style",
				"display:flex;gap:12px;margin-bottom:6px;align-items:flex-start;"
			);

			const nameEl = row.createEl("code", {
				text: entry.name,
			});
			nameEl.setAttr(
				"style",
				"min-width:140px;display:inline-block;font-size:var(--code-size);"
			);

			row.createSpan({
				text: entry.detail,
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

