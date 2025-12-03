import type { DebugCategory } from "./logger";
import type { RankingAlgorithmId } from "./types";

export type LocaleKey = "en" | "zh";

export interface VariableInfo {
	name: string;
	detail: string;
}

const createVariableDetailMap = (
	infos: VariableInfo[]
): Record<string, string> =>
	infos.reduce<Record<string, string>>((acc, info) => {
		acc[info.name] = info.detail;
		return acc;
	}, {});

const BUILTIN_VARIABLE_INFOS_EN: VariableInfo[] = [
	{ name: "TM_FILENAME", detail: "Active file name (with extension)" },
	{ name: "TM_FILEPATH", detail: "Active file path relative to the vault" },
	{ name: "TM_FOLDER", detail: "Name of the folder containing the active file" },
	{ name: "VAULT_NAME", detail: "Current vault name" },
	{ name: "TM_SELECTED_TEXT", detail: "Currently selected text in the editor" },
	{ name: "TM_CLIPBOARD", detail: "Current clipboard text (desktop only)" },
	{ name: "CURRENT_YEAR", detail: "Current year (YYYY)" },
	{ name: "CURRENT_MONTH", detail: "Current month (MM)" },
	{ name: "CURRENT_DATE", detail: "Current date (YYYY-MM-DD)" },
	{ name: "CURRENT_HOUR", detail: "Current hour (HH, 24-hour)" },
	{ name: "CURRENT_MINUTE", detail: "Current minute (MM)" },
	{ name: "CURRENT_SECOND", detail: "Current second (SS)" },
	{ name: "TIME_FORMATTED", detail: "Current time (HH:mm:ss)" },
];

const BUILTIN_VARIABLE_INFOS_ZH: VariableInfo[] = [
	{ name: "TM_FILENAME", detail: "当前文件名（包含扩展名）" },
	{ name: "TM_FILEPATH", detail: "当前文件在仓库中的路径" },
	{ name: "TM_FOLDER", detail: "当前文件所在文件夹名称" },
	{ name: "VAULT_NAME", detail: "当前仓库名称" },
	{ name: "TM_SELECTED_TEXT", detail: "编辑器中当前选中的文本" },
	{ name: "TM_CLIPBOARD", detail: "当前剪贴板文本（仅桌面版）" },
	{ name: "CURRENT_YEAR", detail: "当前年份（YYYY）" },
	{ name: "CURRENT_MONTH", detail: "当前月份（MM）" },
	{ name: "CURRENT_DATE", detail: "当前日期（YYYY-MM-DD）" },
	{ name: "CURRENT_HOUR", detail: "当前小时（HH，24 小时制）" },
	{ name: "CURRENT_MINUTE", detail: "当前分钟（MM）" },
	{ name: "CURRENT_SECOND", detail: "当前秒钟（SS）" },
	{ name: "TIME_FORMATTED", detail: "当前时间（HH:mm:ss）" },
];

export interface LocaleStrings {
	commands: {
		expand: string;
		jumpNext: string;
		jumpPrev: string;
		reload: string;
		debug: string;
		openMenu: string;
	};
	settings: {
		title: string;
		fileName: string;
		fileDesc: string;
		chooseButton: string;
		editButton: string;
		triggerSection: string;
		triggerName: string;
		triggerDesc: string;
		pickerSection: string;
		pickerHint: string;
		menuKeys: {
			nextName: string;
			nextDesc: string;
			prevName: string;
			prevDesc: string;
			acceptName: string;
			acceptDesc: string;
			toggleName: string;
			toggleDesc: string;
			sourceNextName: string;
			sourceNextDesc: string;
			sourcePrevName: string;
			sourcePrevDesc: string;
		};
		rankingSection: string;
		rankingSectionDesc: string;
		rankingStableNote: string;
		rankingPreviewTitle: string;
		rankingPreviewDesc: string;
		rankingPreviewEmpty: string;
		rankingPreviewEntryUsage: string;
		rankingAlgorithmNames: Record<RankingAlgorithmId, string>;
		rankingAlgorithmEnabledDesc: string;
		rankingAlgorithmDisabledDesc: string;
		virtualSection: string;
		showHintsName: string;
		showHintsDesc: string;
		placeholderColorName: string;
		placeholderColorDesc: string;
		choiceHighlightName: string;
		choiceHighlightDesc: string;
		choiceInactiveName: string;
		choiceInactiveDesc: string;
		placeholderActiveName: string;
		placeholderActiveDesc: string;
		ghostTextName: string;
		ghostTextDesc: string;
		virtualPreviewTitle: string;
		virtualPreviewDesc: string;
		virtualPreviewSamplePlaceholder: string;
		virtualPreviewSampleSnippet: string;
		virtualPreviewSampleChoices: string[];
		virtualPreviewSampleGreeting: string;
		virtualPreviewSampleActivePlaceholder: string;
		virtualPreviewSchemeSelectName: string;
		virtualPreviewSchemeSelectDesc: string;
		virtualPreviewSchemeSelectDefault: string;
		virtualPreviewSchemeNameInputName: string;
		virtualPreviewSchemeNameInputDesc: string;
		virtualPreviewSchemeNameInputPlaceholder: string;
		virtualPreviewSaveScheme: string;
		virtualPreviewImportScheme: string;
		virtualPreviewSchemeNameRequired: string;
		virtualPreviewSchemeSaved: string;
		virtualPreviewImportPrompt: string;
		virtualPreviewImportSuccess: string;
		virtualPreviewImportFailed: string;
		virtualPreviewImportUnsupported: string;
		virtualPreviewImportedName: string;
		virtualPreviewImportSchemeDesc: string;
		debugSection: string;
		debugName: string;
		debugDesc: string;
		debugCategoriesName: string;
		debugCategoriesDesc: string;
		debugCategoryOptions: Record<DebugCategory, string>;
		variableHelpName: string;
		variableHelpDesc: string;
		variableDetails: Record<string, string>;
		snippetFilesListName: string;
		snippetFilesListDesc: string;
		snippetFilesOrderHint: string;
		snippetFilesEmpty: string;
		snippetFilesAddButton: string;
		snippetFilesReloadButton: string;
		snippetFilesRemoveButton: string;
		snippetFilesContextButton: string;
		snippetFilesContextTitle: string;
		snippetFilesContextDesc: string;
		snippetFilesContextLanguages: string;
		snippetFilesContextLanguagesPlaceholder: string;
		snippetFilesContextLabels: Record<string, string>;
		referenceSection: string;
		referenceSectionDesc: string;
		referenceEnabledName: string;
		referenceEnabledDesc: string;
		referenceSyncModeName: string;
		referenceSyncModeDesc: string;
		referenceSyncModeRealtime: string;
		referenceSyncModeOnJump: string;
	};
}

const translations: Record<LocaleKey, LocaleStrings> = {
	en: {
		commands: {
			expand: "✨ Expand snippet",
			jumpNext: "➡️ Jump to next tab stop",
			jumpPrev: "⬅️ Jump to previous tab stop",
			reload: "🔄 Reload snippets from file",
			debug: "🧪 Debug: Print snippets to console",
			openMenu: "📋 Open snippet picker",
		},
		settings: {
			title: "📝 ObVsnip Settings",
			fileName: "📁 Snippet file",
			fileDesc: "Choose the VSCode-style JSON that holds your snippets.",
			chooseButton: "Choose file",
			editButton: "Open",
			triggerSection: "⌨️ Trigger key",
			triggerName: "Trigger shortcut",
			triggerDesc:
				'Used for expand/jump fallback, e.g. "Tab" or "Mod-Enter".',
			pickerSection: "🧾 Snippet picker",
			pickerHint:
				"Customize keyboard shortcuts for the inline picker. Leave fields blank to use defaults.",
			menuKeys: {
				nextName: "Next item",
				nextDesc: "Move the selection down.",
				prevName: "Previous item",
				prevDesc: "Move the selection up.",
				acceptName: "Accept selection",
				acceptDesc: "Insert the highlighted snippet.",
				toggleName: "Cycle choices / toggle picker",
				toggleDesc:
					"Cycle choice placeholders when active, otherwise open or close the picker.",
				sourceNextName: "Next source",
				sourceNextDesc: "Switch to the next snippet file source.",
				sourcePrevName: "Previous source",
				sourcePrevDesc: "Switch to the previous snippet file source.",
			},
			rankingSection: "🏅 Ranking algorithms",
			rankingSectionDesc:
				"Enable scoring strategies and drag enabled ones to prioritize them (disabled strategies stay at the bottom).",
			rankingStableNote:
				"Original order acts as a stable tiebreaker when a single algorithm is enabled.",
			rankingPreviewTitle: "Ranking preview",
			rankingPreviewDesc:
				"Simulate how enabled algorithms order the top snippets and surface usage counts.",
			rankingPreviewEmpty: "No snippets loaded yet.",
			rankingPreviewEntryUsage: "Usage",
			rankingAlgorithmNames: {
				"fuzzy-match": "Fuzzy match",
				"prefix-length": "Prefix length",
				alphabetical: "Alphabetical",
				"usage-frequency": "Usage frequency",
				"original-order": "Original order",
			},
			rankingAlgorithmEnabledDesc:
				"Drag to reorder this strategy among other enabled algorithms.",
			rankingAlgorithmDisabledDesc:
				"Disabled strategies are fixed at the bottom until re-enabled.",
			virtualSection: "👻 Virtual text",
				showHintsName: "Show tab stop hints",
			showHintsDesc: "Display ghost-text previews at the next tab stop.",
			placeholderColorName: "Placeholder color",
			placeholderColorDesc: "Define the color used by inline placeholder previews.",
			choiceHighlightName: "Choice highlight color",
			choiceHighlightDesc: "Override the color used to emphasize the currently selected choice caption.",
			choiceInactiveName: "Choice inactive color",
			choiceInactiveDesc: "Color for all other choices so you can see the contrast.",
			placeholderActiveName: "Active placeholder color",
			placeholderActiveDesc: "Customize the highlight for the currently active placeholder.",
			ghostTextName: "Ghost text color",
			ghostTextDesc: "Control the color of ghost tags like the next tab stop indicator.",
			virtualPreviewTitle: "Preview",
			virtualPreviewDesc: "Sample snippet showing how your highlight colors will look.",
			virtualPreviewSamplePlaceholder: "Preview placeholder",
			virtualPreviewSampleSnippet:
				"console.log(${1|Option A,Option B,Option C|});\n$0",
			virtualPreviewSampleChoices: ["Option A", "Option B", "Option C"],
			virtualPreviewSampleGreeting: " — Hello world, $0",
			virtualPreviewSampleActivePlaceholder: "Active placeholder",
			virtualPreviewSchemeSelectName: "Saved color schemes",
			virtualPreviewSchemeSelectDesc:
				"Apply a previously saved palette to the current view.",
			virtualPreviewSchemeSelectDefault: "— select —",
			virtualPreviewSchemeNameInputName: "Scheme name",
			virtualPreviewSchemeNameInputDesc:
				"Give the current palette a name before saving it.",
			virtualPreviewSchemeNameInputPlaceholder: "Enter scheme name",
			virtualPreviewSaveScheme: "Save scheme",
			virtualPreviewImportScheme: "Import scheme",
			virtualPreviewImportSchemeDesc:
				"Paste JSON to import a saved color palette.",
			virtualPreviewSchemeNameRequired:
				"Please provide a name before saving the scheme.",
			virtualPreviewSchemeSaved: "Color scheme saved.",
			virtualPreviewImportPrompt:
				"Paste the JSON representation of a saved color scheme.",
			virtualPreviewImportSuccess: "Color scheme imported.",
			virtualPreviewImportFailed: "Invalid color scheme JSON.",
			virtualPreviewImportUnsupported:
				"Import is not supported in this environment.",
			virtualPreviewImportedName: "Imported scheme",
		debugSection: "🛠️ Debugging",
			debugName: "Enable debug mode",
			debugDesc: "Print diagnostic information to the developer console.",
			debugCategoriesName: "Debug modules",
			debugCategoriesDesc:
				"Pick which modules emit logs (leave empty for all).",
			debugCategoryOptions: {
				general: "General",
				loader: "Loader",
				parser: "Parser",
				manager: "Snippet manager",
				menu: "Menu / UI",
				session: "Session",
			},
			variableHelpName: "Built-in variables",
			variableHelpDesc: "Available variables and usage.",
			variableDetails: createVariableDetailMap(BUILTIN_VARIABLE_INFOS_EN),
			snippetFilesListName: "Snippet files",
			snippetFilesListDesc:
				"Load multiple snippet files; later ones override earlier prefixes.",
			snippetFilesOrderHint:
				"Files load top-to-bottom; remove and re-add to change priority.",
			snippetFilesEmpty: "No snippet files selected.",
			snippetFilesAddButton: "Add file",
			snippetFilesReloadButton: "Reload snippets",
			snippetFilesRemoveButton: "Remove",
			snippetFilesContextButton: "Context rules",
			snippetFilesContextTitle: "Context rules",
			snippetFilesContextDesc:
				"Control where snippets from this file are allowed to trigger.",
			snippetFilesContextLanguages: "Code block languages (comma-separated, empty = any)",
			snippetFilesContextLanguagesPlaceholder: "e.g. javascript, typescript, python",
			snippetFilesContextLabels: {
				anywhere: "Anywhere",
				markdown: "Markdown body",
				codeblock: "Code block",
				"inline-code": "Inline code",
				mathblock: "Math block",
				"inline-math": "Inline math",
			},
			referenceSection: "Reference Snippet",
			referenceSectionDesc: "Enable reference snippets to allow the same tab stop index (e.g., $1) to appear in multiple positions. When you edit one position, other positions can sync automatically.",
			referenceEnabledName: "Enable Reference Snippets",
			referenceEnabledDesc: "Allow the same tab stop index to appear in multiple positions",
			referenceSyncModeName: "Sync Mode",
			referenceSyncModeDesc: "Choose when to sync reference stops: 'realtime' syncs while editing, 'on-jump' syncs when jumping to next tab stop",
			referenceSyncModeRealtime: "Realtime (sync while editing)",
			referenceSyncModeOnJump: "On Jump (sync when jumping)",
		},
	},
	zh: {
		commands: {
			expand: "✨ 展开Snippet",
			jumpNext: "➡️ 跳到下一个占位符",
			jumpPrev: "⬅️ 跳到上一个占位符",
			reload: "🔄 重新载入Snippet文件",
			debug: "🧪 调试：在控制台Snippet片段",
			openMenu: "📋 打开Snippet菜单",
		},
		settings: {
			title: "📝 ObVsnip 设置",
			fileName: "📁 Snippet文件",
			fileDesc: "选择储存 VSCode 风格片段的 JSON 文件。",
			chooseButton: "选择文件",
			editButton: "打开",
			triggerSection: "⌨️ 触发键",
			triggerName: "触发快捷键",
			triggerDesc: "用于展开/跳转兜底，例如 “Tab” 或 “Mod-Enter”。",
			pickerSection: "🧾 片段选择器",
			pickerHint: "自定义snippet菜单的快捷键，留空则使用默认值。",
			menuKeys: {
				nextName: "下一个项目",
				nextDesc: "将选取向下移动。",
				prevName: "上一个项目",
				prevDesc: "将选取向上移动。",
				acceptName: "确认选择",
				acceptDesc: "插入高亮的片段。",
				toggleName: "循环选项 / 打开或关闭选择器",
				toggleDesc: "在候选占位符上循环选项，否则打开或关闭选择器。",
				sourceNextName: "下一个来源",
				sourceNextDesc: "切换到下一个片段文件来源。",
				sourcePrevName: "上一个来源",
				sourcePrevDesc: "切换到上一个片段文件来源。",
			},
			rankingSection: "🏅 排序算法",
			rankingSectionDesc:
				"打开算法后可拖动改变优先级，未开启的算法则固定在底部。",
				rankingStableNote:
					"仅剩一个排序算法时，插件默认使用原始顺序做稳定的 tiebreaker。",
				rankingPreviewTitle: "排序预览",
				rankingPreviewDesc:
					"模拟当前启用的算法如何对片段排序，并展示使用次数。",
				rankingPreviewEmpty: "尚未加载任何片段。",
				rankingPreviewEntryUsage: "使用次数",
			rankingAlgorithmNames: {
				"fuzzy-match": "模糊匹配",
				"prefix-length": "前缀长度",
				alphabetical: "字母顺序",
				"usage-frequency": "使用频率",
				"original-order": "原始顺序",
			},
			rankingAlgorithmEnabledDesc:
				"开启后可拖动以调整优先级。",
			rankingAlgorithmDisabledDesc:
				"关闭时会固定在底部无法拖动。",
				virtualSection: "👻 Virtual text",
					showHintsName: "显示占位符提示",
					showHintsDesc: "在下一个占位符位置显示 Virtual text 提示。",
					placeholderColorName: "占位符颜色",
					placeholderColorDesc: "设置预览占位符的颜色。",
					choiceHighlightName: "选择高亮颜色",
				choiceHighlightDesc: "设置强调当前选择项的颜色，方便在文本中快速识别。",
				choiceInactiveName: "非选中项颜色",
				choiceInactiveDesc: "未选中的 choice 使用此颜色显示。",
				placeholderActiveName: "活动占位符颜色",
				placeholderActiveDesc: "自定义当前占位符的高亮色。",
				ghostTextName: "幽灵文本颜色",
				ghostTextDesc: "控制下一个跳转提示等幽灵文本的颜色。",
					virtualPreviewTitle: "预览",
					virtualPreviewDesc: "示例显示当前配置下的虚拟文本颜色。",
					virtualPreviewSamplePlaceholder: "示例占位符",
					virtualPreviewSampleSnippet:
						"console.log(${1|选项一,选项二,选项三|});\n$0",
					virtualPreviewSampleChoices: ["选项一", "选项二", "选项三"],
					virtualPreviewSampleGreeting: " — 你好，$0",
					virtualPreviewSampleActivePlaceholder: "活跃占位符",
					virtualPreviewSchemeSelectName: "保存的配色方案",
					virtualPreviewSchemeSelectDesc:
						"选择已保存的配色即可立即应用。",
					virtualPreviewSchemeSelectDefault: "— 选择 —",
					virtualPreviewSchemeNameInputName: "方案名称",
					virtualPreviewSchemeNameInputDesc: "为当前配色输入名称。",
					virtualPreviewSchemeNameInputPlaceholder: "输入方案名称",
					virtualPreviewSaveScheme: "保存方案",
					virtualPreviewImportScheme: "导入方案",
					virtualPreviewImportSchemeDesc:
						"粘贴 JSON 文本以导入配色方案。",
					virtualPreviewSchemeNameRequired: "请先填写方案名称。",
					virtualPreviewSchemeSaved: "已保存配色方案。",
					virtualPreviewImportPrompt:
						"粘贴配色方案的 JSON 内容以导入。",
					virtualPreviewImportSuccess: "配色方案导入成功。",
					virtualPreviewImportFailed: "配色方案格式无效。",
					virtualPreviewImportUnsupported: "当前环境不支持导入。",
					virtualPreviewImportedName: "导入的方案",
			debugSection: "🛠️ 调试",
			debugName: "开启调试模式",
			debugDesc: "在开发者控制台输出诊断信息。",
			debugCategoriesName: "调试模块",
			debugCategoriesDesc: "选择需要输出日志的模块（留空表示全部）。",
			debugCategoryOptions: {
				general: "通用",
				loader: "加载器",
				parser: "解析器",
				manager: "管理器",
				menu: "菜单 / UI",
				session: "会话",
			},
			variableHelpName: "内置变量",
			variableHelpDesc: "可用变量与说明。",
			variableDetails: createVariableDetailMap(BUILTIN_VARIABLE_INFOS_ZH),
			snippetFilesListName: "片段文件列表",
			snippetFilesListDesc:
				"可选择多个 JSON 片段文件；若前缀冲突，后面的文件会覆盖前面的定义。",
			snippetFilesOrderHint:
				"文件按从上到下的顺序加载，可通过删除并重新添加来调整优先级。",
			snippetFilesEmpty: "暂未选择片段文件。",
			snippetFilesAddButton: "添加文件",
			snippetFilesReloadButton: "重新加载片段",
			snippetFilesRemoveButton: "删除",
			snippetFilesContextButton: "上下文规则",
			snippetFilesContextTitle: "上下文规则",
			snippetFilesContextDesc:
				"限制该文件中的 snippets 在哪些场景下触发。",
			snippetFilesContextLanguages: "代码块语言（逗号分隔，留空表示任意）",
			snippetFilesContextLanguagesPlaceholder: "例如 javascript, typescript, python",
			snippetFilesContextLabels: {
				anywhere: "任意位置",
				markdown: "Markdown 正文",
				codeblock: "代码块",
				"inline-code": "行内代码",
				mathblock: "公式块 ($$)",
				"inline-math": "行内公式 ($)",
			},
			referenceSection: "引用 Snippet",
			referenceSectionDesc: "启用引用片段功能，允许同一个占位符索引（如 $1）在多个位置出现。当您编辑其中一个位置时，其他位置可以自动同步。",
			referenceEnabledName: "启用引用片段",
			referenceEnabledDesc: "允许同一个占位符索引在多个位置出现",
			referenceSyncModeName: "同步模式",
			referenceSyncModeDesc: "选择何时同步引用占位符：'实时'模式在编辑时同步，'跳转'模式在跳转到下一个占位符时同步",
			referenceSyncModeRealtime: "实时（编辑时同步）",
			referenceSyncModeOnJump: "跳转（跳转时同步）",
		},
	},
};

export const getLocaleStrings = (locale?: string): LocaleStrings => {
	if (!locale) return translations.en;
	const normalized = locale.toLowerCase();
	if (normalized.startsWith("zh")) {
		return translations.zh;
	}
	return translations.en;
};
