export type DebugCategory =
	| "general"
	| "loader"
	| "parser"
	| "manager"
	| "menu"
	| "session";

export class PluginLogger {
	private enabled = false;
	private allowedCategories: Set<DebugCategory> | null = null;

	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
	}

	setCategories(categories: DebugCategory[] | null): void {
		if (!categories || categories.length === 0) {
			this.allowedCategories = null;
		} else {
			this.allowedCategories = new Set(categories);
		}
	}

	debug(category: DebugCategory, ...data: unknown[]): void {
		if (!this.enabled) return;
		if (
			this.allowedCategories &&
			!this.allowedCategories.has(category)
		) {
			return;
		}
		console.log(...data);
	}
}
