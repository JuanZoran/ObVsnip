# ObVsnip

一个在 Obsidian 中复用 VSCode Snippet 体验的插件。插件通过 Trie 匹配、Snippet 会话与补全面板，提供快速输入能力，并在调试模式下提供细粒度日志。

## 功能概述

-   读取 VSCode 风格的 JSON 片段文件，支持 `$1/$2...` 占位、`${1:default}` 默认值与 `${1|a,b|}` 选项。
-   Snippet 会话支持 TabStop 跳转、候选循环（默认 `Ctrl-Space`）、Ghost Text 提示与弹窗候选项，支持隐藏 (`hide: true`) 的片段维持清爽列表。
-   排序策略组合：内置**模糊匹配 / 前缀长度 / 字母顺序 / 使用频率 / 原始顺序**五种算法，可按优先级拖拽调整并保证至少一项开启，原始顺序在单一策略下作为稳定 tiebreaker。
-   虚拟文本设置：可分别控制占位符、活跃占位符、Ghost Text 以及选择项的颜色；设置页提供实时 preview，所有配色通过 CSS 变量驱动 widget 渲染。
-   内置变量：`TM_FILENAME`, `TM_FILEPATH`, `TM_FOLDER`, `VAULT_NAME`, `TM_SELECTED_TEXT`, `TM_CLIPBOARD`, `CURRENT_YEAR`, `CURRENT_MONTH`, `CURRENT_DATE`, `CURRENT_HOUR`, `CURRENT_MINUTE`, `CURRENT_SECOND`, `TIME_FORMATTED`。变量说明可在设置页的“Built-in variables”按钮查看。
-   调试：可以启用 Debug Mode 并仅输出特定模块（General / Loader / Parser / Manager / Menu / Session）的日志，便于定位问题。

## 安装

1. 将仓库放入 `{Vault}/.obsidian/plugins/ObVsnip`。
2. `npm install`
3. `npm run build`（开发模式可 `npm run dev`）
4. 在 Obsidian → 设置 → 社区插件中启用 **ObVsnip**

## 配置亮点

-   **排序算法**：设置页的“Ranking algorithms”区域允许在启用算法后拖拽排序（禁用项固定在末尾），配置保存后会在 snippet picker 中按顺序执行打分与排序。
-   **颜色**：虚拟文本相关颜色拆分为占位符、活跃占位符、ghost text、选中项、未选中项五个设置项，各自配色会同步到实时预览，同时通过 `setSnippetWidgetConfig` 传给 snippet widget。
-   **排序预览**：Ranking 算法区域下方会即时展示按当前排序策略排出的前几条片段及其使用频次，帮助你判断调好的算法是否符合实际需求。
-   **配色方案**：新增保存/导入 JSON 的方案、在编辑器中预览当前配色以及一键恢复默认的控制按钮，方便在真实页面中收敛颜色搭配。
-   **内置主题**：提供 Catppuccin、Tokyonight、GitHub Dark/Light、Everforest、Dracula 等内置调色，亦可保存/导入自定义方案，并直接在编辑器中预览或恢复默认。
-   **隐藏片段**：`hide: true` 的片段即使在“显示所有片段”提示栏也不会渲染，只有 `hide` 修改后重新加载才可见。

## 测试

-   代码使用 TypeScript 编写，构建依赖 `tsc` + `esbuild`（配套 `npm run build`）。
-   单元测试由 Jest 提供，覆盖排序流水线、设置交互、usage tracker、snippet 视觉 widget、suggest picker 等，可通过 `npm run test` 运行。

## Snippet 文件

### 快速开始

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

### 完整示例文档

📖 **查看 [Snippet 功能示例文档](./docs/snippet-examples.md)** 了解所有支持的功能，包括：

- 基本占位符 (`$1`, `$2`)
- 默认值占位符 (`${1:default}`)
- 选择列表 (`${1|a,b,c|}`)
- 内置变量 (`${TM_FILENAME}`, `${CURRENT_YEAR}` 等)
- **引用 Snippet**（多位置同步）- 新功能！
- 嵌套占位符
- 转义字符
- 多行 body
- 隐藏片段和优先级设置

💾 **直接使用**: 复制 [snippets-examples.json](./docs/snippets-examples.json) 到你的仓库，在设置中添加该文件即可开始测试所有功能。

## 调试模式

设置 → “调试”：

-   打开 “Enable debug mode” 开关即可输出日志。
-   “Debug modules” 区域选择需要的模块（默认全部）来过滤日志。
-   ℹ️ 按钮可查看所有内置变量说明。

调试日志均通过 `console.log` 输出，可在开发者工具中查看（`Cmd/Ctrl+Shift+I`）。 अउ
