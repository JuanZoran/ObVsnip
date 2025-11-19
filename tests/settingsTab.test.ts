import {
	TextSnippetsSettingsTab,
	VirtualTextSchemeControls,
} from "../src/settingsTab";
import { getLocaleStrings } from "../src/i18n";
import { DEFAULT_RANKING_ALGORITHMS } from "../src/rankingConfig";
import type { ParsedSnippet } from "../src/types";
import type TextSnippetsPlugin from "../main";

const DOM_HELPERS = [
	"createEl",
	"createDiv",
	"createSpan",
	"empty",
	"setAttr",
	"addClass",
	"removeClass",
	"toggleClass",
];

const ensureDomHelpers = (): () => void => {
	const proto = HTMLElement.prototype as Record<string, any>;
	const originals: Partial<Record<typeof DOM_HELPERS[number], any>> = {};
	for (const helper of DOM_HELPERS) {
		originals[helper] = proto[helper];
	}

	if (!proto.createEl) {
		proto.createEl = function (tag: string, options?: any) {
			const el = document.createElement(tag);
			if (options?.cls) el.className = options.cls;
			if (options?.text) el.textContent = options.text;
			this.appendChild(el);
			return el;
		};
	}
	if (!proto.createDiv) {
		proto.createDiv = function (options?: any) {
			return this.createEl("div", options);
		};
	}
	if (!proto.createSpan) {
		proto.createSpan = function (options?: any) {
			return this.createEl("span", options);
		};
	}
	if (!proto.empty) {
		proto.empty = function () {
			this.textContent = "";
		};
	}
	if (!proto.setAttr) {
		proto.setAttr = function (name: string, value: string) {
			this.setAttribute(name, value);
		};
	}
	if (!proto.addClass) {
		proto.addClass = function (cls: string) {
			this.classList.add(cls);
		};
	}
	if (!proto.removeClass) {
		proto.removeClass = function (cls: string) {
			this.classList.remove(cls);
		};
	}
	if (!proto.toggleClass) {
		proto.toggleClass = function (cls: string, force?: boolean) {
			this.classList.toggle(cls, force);
		};
	}
	if (!proto.setClass) {
		proto.setClass = function (cls: string) {
			this.className = cls;
		};
	}

	return () => {
		for (const helper of DOM_HELPERS) {
			if (originals[helper] === undefined) {
				delete proto[helper];
			} else {
				proto[helper] = originals[helper];
			}
		}
	};
};

	const createPluginMock = (
		enableDebug: boolean
	): {
		settings: TextSnippetsPlugin["settings"];
		getStrings: TextSnippetsPlugin["getStrings"];
		saveSettings: jest.Mock;
		applyRuntimeSettings: jest.Mock;
		getSnippetLoader: TextSnippetsPlugin["getSnippetLoader"];
		getVirtualTextColorPresets: TextSnippetsPlugin["getVirtualTextColorPresets"];
		saveVirtualTextColorPreset: TextSnippetsPlugin["saveVirtualTextColorPreset"];
		applyVirtualTextColorPreset: TextSnippetsPlugin["applyVirtualTextColorPreset"];
		getSelectedVirtualTextPresetName: TextSnippetsPlugin["getSelectedVirtualTextPresetName"];
		getAvailableSnippets: TextSnippetsPlugin["getAvailableSnippets"];
		getSnippetUsageCounts: TextSnippetsPlugin["getSnippetUsageCounts"];
		getRankingAlgorithmNames: TextSnippetsPlugin["getRankingAlgorithmNames"];
	} => {
	const settings: TextSnippetsPlugin["settings"] = {
		snippetFiles: [],
		showVirtualText: true,
		virtualTextColor: "var(--text-muted)",
		enableDebugLogs: enableDebug,
		triggerKey: "Tab",
		menuKeymap: {
			next: "ArrowDown",
			prev: "ArrowUp",
			accept: "Enter",
			toggle: "Ctrl-Space",
		},
		debugCategories: [],
		rankingAlgorithms: DEFAULT_RANKING_ALGORITHMS.map((entry) => ({
			...entry,
		})),
		snippetUsage: {},
		choiceHighlightColor: "#5690ff",
		choiceInactiveColor: "#4dabff",
		placeholderActiveColor: "rgba(86, 156, 214, 0.35)",
		ghostTextColor: "var(--text-muted)",
		virtualTextPresets: [],
		selectedVirtualTextPresetName: "",
	};
	return {
		settings,
		getStrings: () => getLocaleStrings("en"),
		saveSettings: jest.fn().mockResolvedValue(undefined),
		applyRuntimeSettings: jest.fn(),
		getSnippetLoader: () => ({
			getTextFiles: () => [],
		}) as any,
		getVirtualTextColorPresets: jest.fn().mockReturnValue([]),
		saveVirtualTextColorPreset: jest.fn(),
		applyVirtualTextColorPreset: jest.fn(),
		getSelectedVirtualTextPresetName: jest.fn().mockReturnValue(""),
		getAvailableSnippets: jest.fn().mockReturnValue([]),
		getSnippetUsageCounts: jest.fn().mockReturnValue(new Map()),
		getRankingAlgorithmNames: jest
			.fn()
			.mockReturnValue(getLocaleStrings("en").settings.rankingAlgorithmNames),
	};
};

const createTab = (pluginMock: TextSnippetsPlugin) => {
	const app = ({
		workspace: {
			getLeaf: () => ({
				openFile: jest.fn(),
			}),
		},
	} as unknown) as TextSnippetsPlugin["app"];
	return new TextSnippetsSettingsTab(app, pluginMock);
};

describe("TextSnippetsSettingsTab debug area", () => {
	const restoreDomHelpers = ensureDomHelpers();

	afterEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	afterAll(() => {
		restoreDomHelpers();
	});

	it("renders debug modules wrapper and toggles styles predictably", () => {
		const pluginMock = createPluginMock(false) as unknown as TextSnippetsPlugin;
		const tab = createTab(pluginMock);
		const container = document.createElement("div");

		tab["renderDebugModuleSettings"](
			container,
			pluginMock.getStrings().settings
		);

		expect(container.classList.contains("debug-modules-wrapper")).toBe(
			true
		);

		tab["toggleDebugModuleControls"](container, false);
		expect(container.style.display).toBe("none");
		tab["toggleDebugModuleControls"](container, true);
		expect(container.style.display).toBe("");
	});

	it("allows opening built-in variable help irrespective of debug toggle", () => {
		const pluginMock = createPluginMock(false) as unknown as TextSnippetsPlugin;
		const tab = createTab(pluginMock);
		expect(() => tab["showVariableHelp"]()).not.toThrow();
	});
});

describe("TextSnippetsSettingsTab ranking preview", () => {
	const restoreDomHelpers = ensureDomHelpers();

	afterEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	afterAll(() => {
		restoreDomHelpers();
	});

	it("renders ranking preview entries showing usage", () => {
		const pluginMock = createPluginMock(false) as unknown as TextSnippetsPlugin;
		const snippets: ParsedSnippet[] = [
			{
				prefix: "alpha",
				body: "alpha",
				processedText: "alpha",
				tabStops: [],
				description: "Alpha",
			},
			{
				prefix: "beta",
				body: "beta",
				processedText: "beta",
				tabStops: [],
				description: "Beta",
			},
			{
				prefix: "gamma",
				body: "gamma",
				processedText: "gamma",
				tabStops: [],
				description: "Gamma",
			},
		];
		pluginMock.getAvailableSnippets = jest.fn().mockReturnValue(snippets);
		pluginMock.getSnippetUsageCounts = jest.fn().mockReturnValue(
			new Map<string, number>([
				["alpha", 5],
				["beta", 2],
				["gamma", 1],
			])
		);

		const tab = createTab(pluginMock);
		const container = document.createElement("div");
		tab["renderRankingPreview"](
			container,
			pluginMock.getStrings().settings
		);

		const entries = container.querySelectorAll(".ranking-preview-entry");
		expect(entries.length).toBeGreaterThanOrEqual(1);
		expect(container.textContent).toContain("alpha");
		expect(container.textContent).toContain("Usage: 5");
	});
});

describe("VirtualTextSchemeControls", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	it("saves a named color scheme and refreshes the UI", async () => {
		const pluginMock = createPluginMock(false) as unknown as TextSnippetsPlugin;
		const strings = pluginMock.getStrings().settings;
		const updatePreview = jest.fn();
		const refresh = jest.fn();
		const controls = new VirtualTextSchemeControls(
			pluginMock,
			strings,
			updatePreview,
			refresh
		);

		await controls.saveColorScheme("cool");

		expect(pluginMock.saveVirtualTextColorPreset).toHaveBeenCalledWith({
			name: "cool",
			placeholderColor: pluginMock.settings.virtualTextColor,
			placeholderActiveColor: pluginMock.settings.placeholderActiveColor,
			ghostTextColor: pluginMock.settings.ghostTextColor,
			choiceActiveColor: pluginMock.settings.choiceHighlightColor,
			choiceInactiveColor: pluginMock.settings.choiceInactiveColor,
		});
		expect(pluginMock.saveSettings).toHaveBeenCalled();
		expect(refresh).toHaveBeenCalled();
	});

	it("imports a valid preset and updates preview", async () => {
		const pluginMock = createPluginMock(false) as unknown as TextSnippetsPlugin;
		const strings = pluginMock.getStrings().settings;
		const updatePreview = jest.fn();
		const refresh = jest.fn();
		const controls = new VirtualTextSchemeControls(
			pluginMock,
			strings,
			updatePreview,
			refresh
		);

		const presetPayload = {
			name: "imported",
			placeholderColor: "#123456",
			placeholderActiveColor: "#654321",
			ghostTextColor: "#abcdef",
			choiceActiveColor: "#fedcba",
			choiceInactiveColor: "#0f0f0f",
		};
		await controls.importColorScheme(JSON.stringify(presetPayload));

		expect(pluginMock.applyVirtualTextColorPreset).toHaveBeenCalledWith(
			presetPayload
		);
		expect(pluginMock.saveSettings).toHaveBeenCalled();
		expect(updatePreview).toHaveBeenCalled();
		expect(refresh).toHaveBeenCalled();
	});
});
