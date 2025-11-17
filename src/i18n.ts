import type { DebugCategory } from "./logger";

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
		sortName: string;
		sortDesc: string;
		sortOptions: {
			smart: string;
			length: string;
			none: string;
		};
		virtualSection: string;
		showHintsName: string;
		showHintsDesc: string;
		debugSection: string;
		debugName: string;
		debugDesc: string;
		debugCategoriesName: string;
		debugCategoriesDesc: string;
		debugCategoryOptions: Record<DebugCategory, string>;
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
			title: "📝 Text Snippets Settings",
			fileName: "📁 Snippet file",
			fileDesc: "Choose the VSCode-style JSON that holds your snippets.",
			chooseButton: "Choose file",
			editButton: "Edit",
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
			sortName: "Sort mode",
			sortDesc: "Control how the picker orders matching snippets.",
			sortOptions: {
				smart: "Smart (best match first)",
				length: "Prefix length",
				none: "Keep original order",
			},
			virtualSection: "👻 Virtual text",
			showHintsName: "Show tab stop hints",
			showHintsDesc: "Display ghost-text previews at the next tab stop.",
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
		},
	},
	zh: {
		commands: {
			expand: "✨ 展开片段",
			jumpNext: "➡️ 跳到下一个占位符",
			jumpPrev: "⬅️ 跳到上一个占位符",
			reload: "🔄 重新载入片段文件",
			debug: "🧪 调试：在控制台打印片段",
			openMenu: "📋 打开片段选择器",
		},
		settings: {
			title: "📝 文本片段设置",
			fileName: "📁 片段文件",
			fileDesc: "选择储存 VSCode 风格片段的 JSON 文件。",
			chooseButton: "选择文件",
			editButton: "编辑",
			triggerSection: "⌨️ 触发键",
			triggerName: "触发快捷键",
			triggerDesc: "用于展开/跳转兜底，例如 “Tab” 或 “Mod-Enter”。",
			pickerSection: "🧾 片段选择器",
			pickerHint: "自定义内联选择器的快捷键，留空则使用默认值。",
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
			sortName: "排序模式",
			sortDesc: "控制选择器如何排列匹配的片段。",
			sortOptions: {
				smart: "智能排序（最佳匹配优先）",
				length: "按前缀长度",
				none: "保持原始顺序",
			},
			virtualSection: "👻 Virtual text",
			showHintsName: "显示占位符提示",
			showHintsDesc: "在下一个占位符位置显示 Virtual text 提示。",
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
