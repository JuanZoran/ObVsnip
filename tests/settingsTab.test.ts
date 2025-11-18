import { TextSnippetsSettingsTab } from "../src/settingsTab";
import { getLocaleStrings } from "../src/i18n";
import { DEFAULT_RANKING_ALGORITHMS } from "../src/rankingConfig";
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
	};
	return {
		settings,
		getStrings: () => getLocaleStrings("en"),
		saveSettings: jest.fn().mockResolvedValue(undefined),
		applyRuntimeSettings: jest.fn(),
		getSnippetLoader: () => ({
			getTextFiles: () => [],
		}) as any,
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
