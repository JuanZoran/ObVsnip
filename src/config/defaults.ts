import type {
	PluginSettings,
	RankingAlgorithmSetting,
	VirtualTextColorPreset,
	SnippetFileConfig,
	SnippetContextCondition,
} from "../types";
import { DEFAULT_RANKING_ALGORITHMS } from "../rankingConfig";

export const DEFAULT_COLOR_SCHEME: VirtualTextColorPreset = {
	placeholderColor: "var(--text-muted)",
	placeholderActiveColor: "rgba(86, 156, 214, 0.35)",
	ghostTextColor: "var(--text-muted)",
	choiceActiveColor: "#5690ff",
	choiceInactiveColor: "#4dabff",
};

export const BUILTIN_COLOR_SCHEMES: VirtualTextColorPreset[] = [
	{
		name: "Catppuccin",
		placeholderColor: "#f5e0dc",
		placeholderActiveColor: "rgba(255, 171, 185, 0.35)",
		ghostTextColor: "#c6a0f6",
		choiceActiveColor: "#f28fad",
		choiceInactiveColor: "#c6a0f6",
	},
	{
		name: "Tokyonight",
		placeholderColor: "#c0caf5",
		placeholderActiveColor: "rgba(226, 232, 240, 0.35)",
		ghostTextColor: "#9ece6a",
		choiceActiveColor: "#7aa2f7",
		choiceInactiveColor: "#b4f9ff",
	},
	{
		name: "GitHub Dark",
		placeholderColor: "#8b949e",
		placeholderActiveColor: "rgba(139, 148, 158, 0.4)",
		ghostTextColor: "#8b949e",
		choiceActiveColor: "#58a6ff",
		choiceInactiveColor: "#a5d6ff",
	},
	{
		name: "GitHub Light",
		placeholderColor: "#6e7781",
		placeholderActiveColor: "rgba(110, 119, 129, 0.25)",
		ghostTextColor: "#57606a",
		choiceActiveColor: "#0969da",
		choiceInactiveColor: "#1b6bff",
	},
	{
		name: "Everforest",
		placeholderColor: "#a7c080",
		placeholderActiveColor: "rgba(167, 192, 128, 0.4)",
		ghostTextColor: "#7f9f7f",
		choiceActiveColor: "#d5c3a1",
		choiceInactiveColor: "#c0d1a0",
	},
	{
		name: "Dracula",
		placeholderColor: "#f8f8f2",
		placeholderActiveColor: "rgba(248, 248, 242, 0.35)",
		ghostTextColor: "#6272a4",
		choiceActiveColor: "#ff79c6",
		choiceInactiveColor: "#bd93f9",
	},
];

export const DEFAULT_SETTINGS: PluginSettings = {
	snippetFiles: [],
	snippetFileConfigs: {},
	showVirtualText: true,
	virtualTextColor: DEFAULT_COLOR_SCHEME.placeholderColor,
	enableDebugLogs: false,
	triggerKey: "Tab",
	menuKeymap: {
		next: "ArrowDown",
		prev: "ArrowUp",
		accept: "Enter",
		toggle: "Ctrl-Space",
		sourceNext: "Mod-n",
		sourcePrev: "Mod-p",
	},
	debugCategories: [],
	rankingAlgorithms: DEFAULT_RANKING_ALGORITHMS.map((entry) => ({
		...entry,
	})),
	snippetUsage: {},
	choiceHighlightColor: DEFAULT_COLOR_SCHEME.choiceActiveColor,
	choiceInactiveColor: DEFAULT_COLOR_SCHEME.choiceInactiveColor,
	placeholderActiveColor: DEFAULT_COLOR_SCHEME.placeholderActiveColor,
	ghostTextColor: DEFAULT_COLOR_SCHEME.ghostTextColor,
	virtualTextPresets: [],
	selectedVirtualTextPresetName: "",
	referenceSnippetEnabled: true,
	referenceSyncMode: 'realtime',
	lastSnippetSource: "all",
};

const DEFAULT_CONTEXTS: SnippetContextCondition[] = [{ scope: "anywhere" }];

const normalizeContexts = (
	contexts?: SnippetContextCondition[]
): SnippetContextCondition[] => {
	if (!Array.isArray(contexts) || contexts.length === 0) {
		return [...DEFAULT_CONTEXTS];
	}
	return contexts
		.map((entry) => ({
			scope: entry.scope ?? "anywhere",
			languages: Array.isArray(entry.languages)
				? entry.languages.filter((lang) => typeof lang === "string" && lang.trim().length > 0)
				: undefined,
		}))
		.filter((entry) => !!entry.scope);
};

const normalizeSnippetFileConfigs = (
	snippetFiles: string[],
	configs?: Record<string, SnippetFileConfig>
): { files: string[]; configs: Record<string, SnippetFileConfig> } => {
	const baseFiles = Array.isArray(snippetFiles) ? [...snippetFiles] : [];
	const existingConfigs = configs ?? {};
	const normalizedFiles = Array.from(
		new Set(baseFiles.filter((p) => typeof p === "string" && p.length > 0))
	);
	const normalizedConfigs: Record<string, SnippetFileConfig> = {};

	const ensureConfig = (path: string, config?: SnippetFileConfig): SnippetFileConfig => ({
		path,
		enabled: typeof config?.enabled === "boolean" ? config.enabled : true,
		contexts: normalizeContexts(config?.contexts),
	});

	for (const path of normalizedFiles) {
		normalizedConfigs[path] = ensureConfig(path, existingConfigs[path]);
	}

	// 丢弃未在 snippetFiles 中声明的残留配置，避免幽灵来源

	return { files: normalizedFiles, configs: normalizedConfigs };
};

export const ensurePluginSettings = (
	raw?: Partial<PluginSettings>
): PluginSettings => {
	const combined: PluginSettings = {
		...DEFAULT_SETTINGS,
		...raw,
		menuKeymap: {
			...DEFAULT_SETTINGS.menuKeymap,
			...raw?.menuKeymap,
		},
	};
	const normalizedSnippetFiles = normalizeSnippetFileConfigs(
		combined.snippetFiles,
		raw?.snippetFileConfigs ?? combined.snippetFileConfigs
	);
	combined.snippetFiles = normalizedSnippetFiles.files;
	combined.snippetFileConfigs = normalizedSnippetFiles.configs;
	combined.rankingAlgorithms = raw?.rankingAlgorithms
		? [...raw.rankingAlgorithms]
		: [...DEFAULT_SETTINGS.rankingAlgorithms];
	if (!Array.isArray(combined.virtualTextPresets)) {
		combined.virtualTextPresets = [];
	}
	if (!combined.selectedVirtualTextPresetName) {
		combined.selectedVirtualTextPresetName = "";
	}
	return combined;
};
