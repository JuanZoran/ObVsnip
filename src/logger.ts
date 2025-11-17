export class PluginLogger {
	private enabled = false;

	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
	}

	debug(...data: unknown[]): void {
		if (this.enabled) {
			console.log(...data);
		}
	}
}
