import type {
	PluginSettings,
	RankingAlgorithmSetting,
	VirtualTextColorPreset,
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
