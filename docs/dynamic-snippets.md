# 动态 Snippet 设计说明

## 目标  
让插件在运行时根据上下文动态生成 snippet，而不仅仅依赖静态 `snippets.json` 文件。这种方式可以按光标位置、当前文件类型、用户输入或外部数据决定可插入的内容，提升 snippet 的实用度。

## 核心能力
1. **上下文感知**：动态 snippet 应能获取当前光标所在的行/列、选区、语言标签等信息，用来决定是否展示某个候选。
2. **动态内容生成**：支持通过模板、远程配置、变量计算等方式生成 snippet body、prefix、description、tab stops。
3. **兼容现有机制**：生成的 snippet 必须符合 `ParsedSnippet` 结构（含 `processedText`、`tabStops` 等），与现有 `SnippetManager`、`snippetSession` 无缝交互，无需修改跳转逻辑。
4. **性能控制**：动态 snippet 的生成应加入缓存或节流，避免每次打开菜单都重新计算，尤其当涉及网络/复杂处理时。

## 当前 session 结构梳理

1. `SnippetSessionField` 本质上维护一个 `SnippetSessionEntry[]` 的栈，每个 entry 记录了 `currentIndex`（当前激活的 tab stop）和 `tabStops`（绝对位置、choice、choices 列表），在 `src/snippetSession.ts` 中通过 `pushSnippetSessionEffect`/`popSnippetSessionEffect`/`updateSnippetSessionEffect` 操作。
2. `SnippetManager` 通过 `getCurrentSession(editor)` 获取栈顶 entry，结合 `focusStopByOffset` 的定位确定下一个跳转，同时在 `jumpToNextTabStop` 等函数里通过 `session.currentIndex` 判断是否已到 `$0` 或需要展开新 entry。
3. snippet mode 的“激活”判断当前就是：stack 非空（`snippetSessionField.length > 0`）时代表正在运作，否则不处理 Tab；我们在 `snippetSession.ts` 里封装了 `getSnippetSessionStack(view)` / `isSnippetSessionActive(view)` 辅助函数，`SnippetManager.getSnippetState(editor)` 又把它们组合成 `{ active, stack }`，`SnippetManager.isSnippetActive(editor)` 暴露给 menu/命令/变量解析等其他入口调用（他们只需检查 `active`，不用直接读取 stack），这样就算 future 需要改 PDA stack 实现，调用方仍只触 `active` helper。

## 推荐实现方式
1. 在 `SnippetSuggestions` 的 `filterSnippets` 前插入一个 `getDynamicSnippets(query, editor)` 调用，将实时产生的 snippet 合并到静态列表，再走统一排序／匹配。
2. 允许动态 snippet 声明 `priority` 或标识，以便在菜单中用特殊样式提示用户这是“实时内容”。
3. 引入配置项控制动态源（例如启/禁、节流时间、只针对某些前缀），避免干扰默认查找。

## 额外字段建议

在 snippet 文件中加入 `hide?: boolean` 选项可以让某些 snippet 只通过 prefix/命令触发而不出现在菜单里；动态 snippet 同样可以设置 `hide`，以便在菜单中保留更简洁的结果。此字段只影响 UI 列表，不会阻止 snippet 运行，还可以搭配 `priority` 说明排序权重。

## 风险与防范
- **卡顿**：动态生成过程如果耗时，可能拖慢菜单响应，建议异步预计算并缓存结果，或只在特定命令触发时更新。
- **可维护性**：更多动态逻辑意味着调试复杂度上升，建议把生成逻辑与核心 snippet engine 保持解耦，封装在独立模块。
- **安全性**：若支持远程模板，必须校验内容、避免执行任意脚本，建议仅支持文本型模板并把变量解析交给现有机制处理。

该文档可作为后续开发动态 snippet 功能的规范参考。需要我再制定 API 草案或示例模块吗？
