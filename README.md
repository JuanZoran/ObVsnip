# ObVsnip

一个在 Obsidian 中复用 VSCode Snippet 体验的插件。插件通过 Trie 匹配、Snippet 会话与补全面板，提供快速输入能力，并在调试模式下提供细粒度日志。

## 功能概述

-   读取 VSCode 风格的 JSON 片段文件，支持 `$1/$2...` 占位、`${1:default}` 默认值与 `${1|a,b|}` 选项。
-   Snippet 会话支持 TabStop 跳转、候选循环（默认 `Ctrl-Space`）、Ghost Text 提示等。
-   内置变量：`TM_FILENAME`, `TM_FILEPATH`, `TM_FOLDER`, `VAULT_NAME`, `TM_SELECTED_TEXT`, `TM_CLIPBOARD`, `CURRENT_YEAR`, `CURRENT_MONTH`, `CURRENT_DATE`, `CURRENT_HOUR`, `CURRENT_MINUTE`, `CURRENT_SECOND`, `TIME_FORMATTED`。变量说明可在设置页的“Built-in variables”按钮查看。
-   调试：可以启用 Debug Mode 并仅输出特定模块（General / Loader / Parser / Manager / Menu / Session）的日志，便于定位问题。



## 安装

1. 将仓库放入 `{Vault}/.obsidian/plugins/text-trigger-obsidian`。
2. `npm install`
3. `npm run build`（开发模式可 `npm run dev`）
4. 在 Obsidian → 设置 → 社区插件中启用 **ObVsnip**

## Snippet 文件

示例（`snippets.json`）：

```json
{
	"latex-note": {
		"prefix": "note",
		"body": [
			"> [!note]",
			"> ${1:content}",
			"",
			"Author: ${VAULT_NAME}",
			"Date: ${CURRENT_DATE}"
		],
		"description": "LaTeX/Markdown 备注模板"
	}
}
```

## 调试模式

设置 → “调试”：

-   打开 “Enable debug mode” 开关即可输出日志。
-   “Debug modules” 区域选择需要的模块（默认全部）来过滤日志。
-   ℹ️ 按钮可查看所有内置变量说明。

调试日志均通过 `console.log` 输出，可在开发者工具中查看（`Cmd/Ctrl+Shift+I`）。 अउ
