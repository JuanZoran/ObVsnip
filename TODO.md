TODO
======

- [x] 调整设置模型：`PluginSettings` 增加 `snippetFileConfigs`，定义 `SnippetContextCondition` 类型，`defaults` 里给出默认值。
- [x] 迁移逻辑：在 `loadSettings/ensurePluginSettings` 中把旧的 `snippetFiles: string[]` 转成带 `contexts: [{ scope: "anywhere" }]` 的配置，并维持原有 `snippetFiles` 兼容。
- [x] 上下文探测：新增 `utils/editorContext.ts`，实现 `getCursorContext(editor)`，涵盖 fenced code（含语言）、inline code、math block、inline math、frontmatter。
- [x] 引擎支持多候选：`SnippetEngine` trie 节点存储多个 snippets，新增 `matchSnippets()` 返回所有匹配项，保留原优先级排序。
- [x] 上下文过滤：实现 `filterSnippetsByContext`（基于 snippet.source 查配置），并在 `SnippetManager.findSnippetMatch` 和 `SnippetCompletionMenu` 里应用。
- [x] 设置 UI：`SnippetFilesSettings` 行内添加上下文勾选（Anywhere/Markdown/Code block+语言/Inline code/Math block/Inline math），保存到对应 config；新增文件时创建默认配置。
- [x] 源列表兼容：`getSnippetSources/setCurrentSnippetSource` 改读 configs，仍暴露 “all + path”。
- [x] 测试：为 `editorContext`、`filterSnippetsByContext`、菜单过滤/触发流程添加单测或轻量集成测试。
