import type { DebugCategory } from "./logger";
import type { RankingAlgorithmId } from "./types";

export type LocaleKey = "en" | "zh";

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
		};
		rankingSection: string;
		rankingSectionDesc: string;
		rankingStableNote: string;
		rankingAlgorithmNames: Record<RankingAlgorithmId, string>;
		rankingAlgorithmEnabledDesc: string;
		rankingAlgorithmDisabledDesc: string;
		virtualSection: string;
		showHintsName: string;
		showHintsDesc: string;
		choiceHighlightName: string;
		choiceHighlightDesc: string;
		choiceInactiveName: string;
		choiceInactiveDesc: string;
		placeholderActiveName: string;
		placeholderActiveDesc: string;
		ghostTextName: string;
		ghostTextDesc: string;
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
			},
			rankingSection: "🏅 Ranking algorithms",
			rankingSectionDesc:
				"Enable scoring strategies and drag enabled ones to prioritize them (disabled strategies stay at the bottom).",
			rankingStableNote:
				"Original order acts as a stable tiebreaker when a single algorithm is enabled.",
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
			choiceHighlightName: "Choice highlight color",
			choiceHighlightDesc:
				"Override the color used to emphasize the currently selected choice caption.",
			choiceInactiveName: "Choice inactive color",
			choiceInactiveDesc:
				"Color for all other choices so you can see the contrast.",
			placeholderActiveName: "Active placeholder color",
			placeholderActiveDesc:
				"Customize the highlight for the currently active placeholder.",
			ghostTextName: "Ghost text color",
			ghostTextDesc:
				"Control the color of ghost tags like the next tab stop indicator.",
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
			variableDetails: {
				TM_FILENAME: "Active file name (with extension)",
				TM_FILEPATH: "Active file path relative to the vault",
				TM_FOLDER: "Name of the folder containing the active file",
				VAULT_NAME: "Current vault name",
				TM_SELECTED_TEXT: "Currently selected text in the editor",
				TM_CLIPBOARD: "Current clipboard text (desktop only)",
				CURRENT_YEAR: "Current year (YYYY)",
				CURRENT_MONTH: "Current month (MM)",
				CURRENT_DATE: "Current date (YYYY-MM-DD)",
				CURRENT_HOUR: "Current hour (HH, 24-hour)",
				CURRENT_MINUTE: "Current minute (MM)",
				CURRENT_SECOND: "Current second (SS)",
				TIME_FORMATTED: "Current time (HH:mm:ss)",
			},
			snippetFilesListName: "Snippet files",
			snippetFilesListDesc:
				"Load multiple snippet files; later ones override earlier prefixes.",
			snippetFilesOrderHint:
				"Files load top-to-bottom; remove and re-add to change priority.",
			snippetFilesEmpty: "No snippet files selected.",
			snippetFilesAddButton: "Add file",
			snippetFilesReloadButton: "Reload snippets",
			snippetFilesRemoveButton: "Remove",
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
			},
			rankingSection: "🏅 排序算法",
			rankingSectionDesc:
				"打开算法后可拖动改变优先级，未开启的算法则固定在底部。",
			rankingStableNote:
				"仅剩一个排序算法时，插件默认使用原始顺序做稳定的 tiebreaker。",
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
			choiceHighlightName: "选择高亮颜色",
			choiceHighlightDesc:
				"设置强调当前选择项的颜色，方便在文本中快速识别。",
			choiceInactiveName: "非选中项颜色",
			choiceInactiveDesc: "未选中的 choice 使用此颜色显示。",
			placeholderActiveName: "活动占位符颜色",
			placeholderActiveDesc: "自定义当前占位符的高亮色。",
			ghostTextName: "幽灵文本颜色",
			ghostTextDesc: "控制下一步/跳转提示等幽灵文本的颜色。",
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
			variableDetails: {
				TM_FILENAME: "当前文件名（包含扩展名）",
				TM_FILEPATH: "当前文件在仓库中的路径",
				TM_FOLDER: "当前文件所在文件夹名称",
				VAULT_NAME: "当前仓库名称",
				TM_SELECTED_TEXT: "编辑器中当前选中的文本",
				TM_CLIPBOARD: "当前剪贴板文本（仅桌面版）",
				CURRENT_YEAR: "当前年份（YYYY）",
				CURRENT_MONTH: "当前月份（MM）",
				CURRENT_DATE: "当前日期（YYYY-MM-DD）",
				CURRENT_HOUR: "当前小时（HH，24 小时制）",
				CURRENT_MINUTE: "当前分钟（MM）",
				CURRENT_SECOND: "当前秒钟（SS）",
				TIME_FORMATTED: "当前时间（HH:mm:ss）",
			},
			snippetFilesListName: "片段文件列表",
			snippetFilesListDesc:
				"可选择多个 JSON 片段文件；若前缀冲突，后面的文件会覆盖前面的定义。",
			snippetFilesOrderHint:
				"文件按从上到下的顺序加载，可通过删除并重新添加来调整优先级。",
			snippetFilesEmpty: "暂未选择片段文件。",
			snippetFilesAddButton: "添加文件",
			snippetFilesReloadButton: "重新加载片段",
			snippetFilesRemoveButton: "删除",
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
