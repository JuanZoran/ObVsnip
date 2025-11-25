# ObVsnip 项目架构文档

## 目录

1. [项目概述](#项目概述)
2. [整体架构](#整体架构)
3. [模块功能详解](#模块功能详解)
4. [工作流程](#工作流程)
5. [设计模式分析](#设计模式分析)
6. [关键技术点](#关键技术点)

---

## 项目概述

### 项目简介

ObVsnip 是一个为 Obsidian 编辑器提供 VSCode 风格代码片段（Snippet）支持的插件。它允许用户通过简单的前缀触发，快速插入预定义的代码模板，支持占位符、变量替换、TabStop 跳转等高级功能。

### 核心功能

- **VSCode 兼容的片段格式**：支持标准的 JSON 片段文件格式
- **智能前缀匹配**：基于 Trie 树的高效前缀匹配算法
- **TabStop 导航**：支持 `$1`, `$2` 等占位符的跳转和编辑
- **变量替换**：内置多种变量（文件名、日期、剪贴板等）
- **选择项支持**：支持 `${1|option1,option2|}` 格式的选择列表
- **补全菜单**：可搜索的片段选择界面，支持多种排序算法
- **虚拟文本渲染**：在编辑器中高亮显示占位符和提示文本
- **使用频率追踪**：记录片段使用情况，优化排序
- **隐藏与约束**：`hide: true` 片段不出现在菜单；排序算法始终至少启用 1 个策略

### 技术栈

- **语言**：TypeScript
- **框架**：Obsidian Plugin API
- **编辑器集成**：CodeMirror 6 (`@codemirror/state`, `@codemirror/view`)
- **构建工具**：esbuild + TypeScript Compiler
- **测试框架**：Jest
- **包管理**：npm

---

## 整体架构

### 架构层次

```
┌─────────────────────────────────────────────────────────┐
│                    Obsidian Plugin Layer                │
│  (main.ts - TextSnippetsPlugin)                        │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Core Service Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │SnippetLoader │  │SnippetEngine │  │SnippetManager │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │SnippetParser │  │VariableResolver│ │SnippetSuggest │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌──────────────┐  ┌──────────────┐                   │
│  │TabStopJump   │  │TabStopPlace  │                   │
│  │Strategy      │  │holderStrategy│                   │
│  └──────────────┘  └──────────────┘                   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│           CodeMirror Integration Layer                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │SnippetSession│  │KeymapExtension│ │Widget System  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 核心组件关系

```
TextSnippetsPlugin (主插件类)
    ├── SnippetLoader (片段加载器)
    │   └── SnippetParser (JSON 解析器)
    │       └── SnippetBody (片段体处理)
    ├── SnippetEngine (片段引擎)
    │   └── Trie 树 (前缀匹配)
    ├── SnippetManager (片段管理器)
    │   ├── SnippetSession (会话管理)
    │   ├── VariableResolver (变量解析)
    │   ├── TabStopJumpStrategy (跳转策略)
    │   │   └── StandardJumpStrategy (标准跳转)
    │   └── TabStopPlaceholderStrategy (占位符策略)
    │       ├── StandardPlaceholderStrategy (标准占位符)
    │       └── ChoicePlaceholderStrategy (选择项占位符)
    ├── SnippetCompletionMenu (补全菜单)
    │   └── SnippetRankingPipeline (排序流水线)
    │       └── UsageTracker (使用追踪)
    └── SettingsTab (设置界面)
```

### 数据流向

1. **加载阶段**：
   ```
   文件系统 → SnippetLoader → SnippetParser → ParsedSnippet[] → SnippetEngine
   ```

2. **匹配阶段**：
   ```
   用户输入 → 前缀提取 → Trie 树查找 → 匹配片段
   ```

3. **展开阶段**：
   ```
   匹配片段 → 变量替换 → TabStop 解析 → 文本插入 → Session 创建 → 使用次数累计（防抖保存）
   ```

4. **交互阶段**：
   ```
   键盘事件 → Keymap → SnippetManager → Session 更新 → Widget 渲染
   ```

---

## 模块功能详解

### 1. 核心加载模块

#### SnippetLoader (`src/snippetLoader.ts`)

**职责**：从 Obsidian 文件系统中加载片段文件

**主要功能**：
- 从配置的文件路径读取 JSON 文件
- 处理文件不存在或格式错误的情况
- 记录加载统计信息（成功/失败数量）
- 提供文件列表查询功能

**关键方法**：
- `loadFromFile(filePath: string)`: 异步加载单个片段文件
- `getTextFiles()`: 获取所有可用的 JSON 文件列表

**设计特点**：
- 使用 Obsidian 的 `vault.read()` API 读取文件
- 错误处理完善，失败时返回空数组而非抛出异常
- 通过 Notice 和日志输出成功/失败列表，额外统计隐藏片段数量

#### SnippetParser (`src/snippetParser.ts`)

**职责**：解析 VSCode 格式的 JSON 片段文件

**主要功能**：
- 解析 JSON 格式的片段定义
- 支持对象和数组两种格式
- 验证片段有效性（必须有 prefix 和 body）
- 规范化片段体（数组转字符串）

**关键方法**：
- `parseJson(content: string)`: 静态方法，解析 JSON 字符串
- `isValidSnippet(obj: any)`: 验证片段格式
- `normalizeSnippet(snippet)`: 规范化片段体格式

**设计特点**：
- 使用静态方法，便于测试
- 严格的类型检查
- 支持向后兼容的格式变体
- 插入前若缺少 processed 字段会惰性重新解析，兼容旧缓存

### 2. 片段处理模块

#### SnippetBody (`src/snippetBody.ts`)

**职责**：解析片段体中的占位符、变量和选择项

**主要功能**：
- 解析 `$1`, `$2` 等 TabStop 占位符
- 解析 `${1:default}` 格式的默认值（默认文本直接插入到处理后的文本中）
- 解析 `${1|a,b,c|}` 格式的选择列表（第一个 choice 插入，choices 列表保留）
- 解析 `${VAR}` 和 `${VAR:default}` 变量
- 处理转义字符（`\$`, `\\`）
- 自动添加隐式的 `$0` TabStop

**关键数据结构**：
```typescript
interface ProcessedSnippetBody {
    text: string;              // 处理后的文本
    tabStops: TabStopInfo[];   // TabStop 位置信息
    variables: SnippetVariableInfo[];  // 变量位置信息
}
```

**解析算法**：
- 使用状态机模式解析复杂语法
- 递归处理嵌套的占位符
- 维护字符位置映射，确保 TabStop 位置准确

**设计特点**：
- 完整的语法支持（符合 VSCode 规范）
- 详细的调试日志输出
- 错误恢复机制（遇到错误时尽可能继续解析）

#### VariableResolver (`src/variableResolver.ts`)

**职责**：解析内置变量并返回实际值

**支持的变量**：
- `TM_FILENAME`: 当前文件名
- `TM_FILEPATH`: 当前文件路径
- `TM_FOLDER`: 当前文件所在文件夹
- `VAULT_NAME`: 仓库名称
- `TM_SELECTED_TEXT`: 选中的文本
- `TM_CLIPBOARD`: 剪贴板内容
- `CURRENT_YEAR/MONTH/DATE`: 日期相关
- `CURRENT_HOUR/MINUTE/SECOND`: 时间相关
- `TIME_FORMATTED`: 格式化时间

**关键方法**：
- `resolveVariableValue(name, context)`: 解析变量值

**设计特点**：
- 使用策略模式，每个变量独立处理
- 返回 `{value, reason}` 结构，便于错误处理
- 支持默认值回退机制

### 3. 片段引擎模块

#### SnippetEngine (`src/snippetEngine.ts`)

**职责**：管理片段集合，提供高效的前缀匹配

**核心数据结构**：
```typescript
interface TrieNode {
    children: Map<string, TrieNode>;
    snippet?: ParsedSnippet;  // 叶子节点存储片段
}
```

**主要功能**：
- 构建 Trie 树索引所有片段前缀
- 计算前缀长度范围（minLength, maxLength）
- 在光标前文本中匹配片段前缀
- 提取匹配的前缀位置信息

**匹配算法**：
1. 从光标位置向前提取最多 `maxLength` 个字符
2. 从最短子串开始，逐步扩展，尝试匹配
3. 使用 Trie 树进行 O(m) 时间复杂度的精确匹配（m 为前缀长度）

**关键方法**：
- `setSnippets(snippets)`: 设置片段并重建 Trie
- `matchSnippetInContext(beforeCursor)`: 匹配片段
- `extractMatchedPrefix()`: 提取匹配的前缀范围

**设计特点**：
- Trie 树提供 O(m) 匹配性能
- 更偏好离光标最近的短前缀（命中即返回）
- 自动计算前缀范围，优化匹配窗口

### 4. 片段管理模块

#### SnippetManager (`src/snippetManager.ts`)

**职责**：管理片段的插入、TabStop 跳转和会话状态

**主要功能**：
- **片段展开**：将匹配的片段插入编辑器
- **TabStop 跳转**：向前/向后跳转到下一个占位符
- **选择项循环**：在 `${1|a,b|}` 类型的占位符中循环选择
- **变量替换**：在插入前替换所有变量
- **会话管理**：创建和维护片段会话状态
- **强制退出**：退出片段编辑模式

**关键流程**：

1. **展开片段**：
   ```
   查找匹配 → 解析变量 → 替换文本 → 插入编辑器 → 创建 Session → 聚焦第一个 TabStop
   ```

2. **TabStop 跳转**：
   ```
   获取当前 Session → 查找下一个 TabStop → 检查退出条件 → 更新 Session → 聚焦 TabStop
   ```

3. **变量替换**：
   ```
   解析变量位置 → 逐个替换 → 调整 TabStop 位置偏移 → 处理缺失变量
   ```

**关键方法**：
- `expandSnippet()`: 展开匹配的片段
- `jumpToNextTabStop()`: 跳转到下一个 TabStop
- `jumpToPrevTabStop()`: 跳转到上一个 TabStop
- `cycleChoiceAtCurrentStop()`: 循环选择项
- `applySnippetAtCursor()`: 在光标位置应用指定片段

**设计特点**：
- **策略模式重构**：使用双策略模式处理 TabStop 行为
  - **跳转策略** (`TabStopJumpStrategy`)：处理如何找到下一个/上一个 TabStop
  - **占位符策略** (`TabStopPlaceholderStrategy`)：处理不同类型的 TabStop 行为（初始化、聚焦、特殊操作）
- 完整的 TabStop 跳转逻辑（包括 `$0` 处理）
- 零长度 `$0`、选区覆盖 `$0`、`$0` 与当前 stop 重叠时提前退出
- 支持嵌套片段（通过 Session 栈）
- 变量替换时自动调整 TabStop 位置
- 变量缺失时弹出 Notice，应用成功会更新 usage（1 秒防抖保存）
- Choice TabStop 的特殊行为通过 `ChoicePlaceholderStrategy` 封装

### 5. TabStop 策略模块

#### TabStopJumpStrategy (`src/tabStopJumpStrategy.ts`)

**职责**：处理 TabStop 跳转逻辑的策略模式实现

**核心接口**：
```typescript
interface TabStopJumpStrategy {
    selectNext(session: SnippetSessionEntry, currentIndex: number): JumpCandidate | null;
    selectPrev(session: SnippetSessionEntry, currentIndex: number): JumpCandidate | null;
    matches(stop: SnippetSessionStop): boolean;
}
```

**实现策略**：
- **StandardJumpStrategy**：标准跳转策略，基于 index 的简单查找
  - 查找 `currentIndex + 1`
  - 如果不存在且 `currentIndex !== 0`，则查找 `$0`
  - 匹配所有 stop（默认策略）

**策略选择器**：
- `TabStopJumpStrategySelector`：根据 stop 类型选择适当的跳转策略
- 已实现策略：
  - `StandardJumpStrategy`：标准跳转策略（默认，匹配所有 stop）
  - `ReferenceJumpStrategy`：引用类型 stop 的跳转策略（已实现）
- 未来扩展：支持函数 snippet（`FunctionJumpStrategy`，管道语法）

**设计特点**：
- 职责分离：跳转逻辑独立于占位符行为
- 易于扩展：新增跳转类型只需添加新策略
- 按 stop 级别选择策略，支持同一 snippet 中混合不同类型

#### TabStopPlaceholderStrategy (`src/tabStopPlaceholderStrategy.ts`)

**职责**：处理不同类型 TabStop 占位符行为的策略模式实现

**核心接口**：
```typescript
interface TabStopPlaceholderStrategy {
    onStopInitialized?(editor: Editor, stop: SnippetSessionStop): void;
    onStopFocused?(editor: Editor, stop: SnippetSessionStop): void;
    onStopEdited?(editor: Editor, stop: SnippetSessionStop, newText: string, settings: PluginSettings): void;
    matches(stop: SnippetSessionStop): boolean;
    getSpecialActions?(stop: SnippetSessionStop): string[];
    executeSpecialAction?(editor: Editor, stop: SnippetSessionStop, action: string): boolean;
}
```

**实现策略**：
- **StandardPlaceholderStrategy**：标准占位符策略
  - 默认行为，匹配所有 stop（fallback）
  - 无特殊初始化或聚焦处理

- **ChoicePlaceholderStrategy**：选择项占位符策略
  - 匹配有 `choices` 属性的 stop
  - 支持 `cycleChoice` 特殊操作
  - 封装 `cycleChoiceAtCurrentStop()` 的逻辑

**默认值占位符处理**：
- **当前实现**：默认值占位符 `${1:defaultText}` 已经支持
  - 解析时，默认文本直接插入到 `processedText` 中
  - TabStop 的 start 和 end 位置包含这个默认文本
  - 当聚焦到这个 TabStop 时，默认文本已经被选中（因为它在 start 和 end 之间）
  - 使用 `StandardPlaceholderStrategy`（因为默认文本已作为初始内容）
- **与 Choice 的区别**：
  - Choice: 第一个 choice 被插入，但 choices 列表被保留在 `TabStopInfo.choices` 中，可以循环
  - Default: 默认文本被插入，但没有单独的字段存储，无法区分是默认值还是用户输入

**策略选择器**：
- `TabStopPlaceholderStrategySelector`：根据 stop 类型选择适当的占位符策略
- 按特异性匹配：choice > standard（默认值使用 standard）

**设计特点**：
- 职责分离：占位符行为独立于跳转逻辑
- 组合使用：一个 stop 可同时使用跳转策略和占位符策略
  - 例如：Choice tabstop 使用 `StandardJumpStrategy` + `ChoicePlaceholderStrategy`
  - 例如：Default tabstop 使用 `StandardJumpStrategy` + `StandardPlaceholderStrategy`
- 易于扩展：新增占位符类型只需添加新策略

### 6. 会话管理模块

#### SnippetSession (`src/snippetSession.ts`)

**职责**：管理 CodeMirror 编辑器中的片段会话状态和视觉渲染

**核心概念**：

1. **StateField**：使用 CodeMirror 的 StateField 存储会话栈
   ```typescript
   snippetSessionField: StateField<SnippetSessionEntry[]>
   ```

2. **Session Entry**：每个片段会话包含
   - `currentIndex`: 当前活跃的 TabStop 索引
   - `stops`: 所有 TabStop 的位置信息

3. **Effects**：使用 StateEffect 更新状态
   - `pushSnippetSessionEffect`: 创建新会话
   - `popSnippetSessionEffect`: 结束当前会话
   - `updateSnippetSessionEffect`: 更新当前索引
   - `clearSnippetSessionsEffect`: 清空所有会话

**视觉渲染**：

1. **占位符高亮**：
   - 非活跃占位符：使用 `cm-snippet-placeholder` 类
   - 活跃占位符：使用 `cm-snippet-placeholder-active` 类

2. **Ghost Text**：显示下一个 TabStop 的提示（如 `$2`）

3. **选择项提示**：对于有选择项的 TabStop，显示选择列表

4. **Widget 系统**：
   - `NextTabStopWidget`: 显示下一个 TabStop 提示
   - `ChoiceHintWidget`: 显示选择项列表

**关键机制**：

- **位置映射**：文档变更时自动映射 TabStop 位置
- **装饰更新**：文档或选择变化时重新计算装饰
- **配置驱动**：通过 `SnippetWidgetConfig` 控制颜色和显示
- **渲染策略**：仅绘制当前及之后的 stop；零长度 stop 仅在活跃时渲染；下一个 stop 与 choice 提示通过 widget 注入

**设计特点**：
- 完全基于 CodeMirror 6 的状态系统
- 响应式更新（文档变更自动同步）
- 可配置的视觉样式
- 支持多会话栈（嵌套片段）

### 6. 补全菜单模块

#### SnippetCompletionMenu (`src/snippetSuggest.ts`)

**职责**：提供可搜索的片段选择界面

**主要功能**：
- **实时搜索**：根据输入的前缀/描述过滤片段
- **排序显示**：使用多种算法对结果排序
- **预览面板**：显示选中片段的预览
- **键盘导航**：支持方向键、Enter、Escape
- **鼠标交互**：点击选择、悬停高亮
- **隐藏过滤**：`hide: true` 的片段不出现在菜单列表

**搜索算法**：

1. **后缀候选**：从查询字符串构造后缀（由短到长）
2. **前缀/模糊/描述匹配**：针对候选在 prefix 与 description 上做前缀、模糊、包含匹配
3. **最佳匹配域记录**：保留最佳命中的候选长度以辅助回放替换范围
4. **后备展示**：无匹配时回退展示全部片段并提示空状态文案

**关键方法**：
- `open(editor, query)`: 打开菜单
- `toggle(editor, query)`: 切换菜单显示
- `filterSnippets(query)`: 过滤片段
- `updateEntriesForQuery(query)`: 更新条目并排序
- `applySelection(index)`: 应用选中的片段

**设计特点**：
- 实时响应编辑器内容变化
- 智能的查询上下文提取
- 支持显示所有片段（无匹配时）
- 完整的键盘和鼠标交互支持
- 启用算法名称以徽章展示排序顺序（中英文取决于 locale）
- 预览使用当前 widget 配色模拟占位符/choice 高亮，并显示命中字段
- 查询和排序耗时写入调试日志，便于分析性能

### 7. 排序流水线模块

#### SnippetRankingPipeline (`src/snippetRankingPipeline.ts`)

**职责**：对片段列表进行多策略排序

**支持的排序算法**：

1. **模糊匹配 (fuzzy-match)**：
   - 精确匹配：0 分
   - 前缀匹配：1 分
   - 包含匹配：10 + 位置偏移
   - 无匹配：1000 + 长度

2. **前缀长度 (prefix-length)**：
   - 短前缀优先（更精确）

3. **字母顺序 (alphabetical)**：
   - 按前缀字母顺序

4. **使用频率 (usage-frequency)**：
   - 使用次数多的优先

5. **原始顺序 (original-order)**：
   - 保持加载时的顺序

**排序策略**：
- 按配置的顺序依次应用算法
- 如果两个片段在某算法下相等，使用下一个算法
- 所有算法都相等时，使用稳定回退（优先级 → 长度 → 字母 → 原始索引）

**关键方法**：
- `rankSnippets(snippets, algorithms, context)`: 主排序函数
- `compareByAlgorithm()`: 按指定算法比较

**设计特点**：
- 可配置的算法组合
- 稳定的排序结果
- 支持上下文信息（查询、使用统计）
- 归一化配置：启用项在前、禁用项在后，保证至少一个算法启用

### 8. 使用追踪模块

#### UsageTracker (`src/usageTracker.ts`)

**职责**：追踪片段使用频率

**主要功能**：
- 记录片段使用次数
- 将使用记录转换为 Map 格式
- 提供增量更新接口

**关键方法**：
- `incrementUsageCount(usage, prefix)`: 增加使用计数
- `usageRecordToMap(usage)`: 转换为 Map

**设计特点**：
- 简单的键值对存储
- 延迟保存机制（1 秒防抖）
- 集成到插件设置中持久化

### 9. 设置界面模块

#### SettingsTab (`src/settingsTab.ts`)

**职责**：提供插件配置界面

**主要配置项**：
- 片段文件列表
- 触发键设置
- 菜单快捷键配置
- 虚拟文本颜色配置
- 排序算法配置
- 调试选项

**特色功能**：
- **颜色方案管理**：支持保存/导入/预览配色方案
- **内置主题**：提供多种预设配色（Catppuccin、Tokyonight 等）
- **实时预览**：在设置页预览片段效果
- **排序算法配置**：可拖拽调整算法优先级
- **变量帮助**：显示所有内置变量说明
- **快捷键配置**：触发键与菜单快捷键可按需自定义
- **排序约束**：至少保留 1 个启用算法，禁用项固定在列表底部

**设计特点**：
- 使用 Obsidian 的 Setting API
- 模块化的设置组件
- 实时应用配置变更

### 10. 辅助工具模块

#### Logger (`src/logger.ts`)

**职责**：提供分类调试日志

**功能**：
- 支持按模块分类（general, loader, parser, manager, menu, session）
- 可启用/禁用日志
- 可过滤特定模块的日志

**设计特点**：
- 简单的单例模式
- 生产环境可完全禁用

#### EditorUtils (`src/editorUtils.ts`)

**职责**：提供编辑器相关的工具函数

**功能**：
- 获取当前活动的编辑器
- 获取 CodeMirror EditorView 实例
- 处理编辑器 API 的兼容性

#### PrefixContext (`src/prefixContext.ts`)

**职责**：提取光标前的文本上下文

**功能**：
- 根据前缀长度范围提取文本
- 返回文本和位置信息

#### Keymap (`src/keymap.ts`)

**职责**：构建 CodeMirror 键盘映射扩展

**功能**：
- 配置触发键
- 配置菜单快捷键
- 处理退出快捷键

---

## 工作流程

### 1. 片段加载流程

```
用户配置片段文件路径
    ↓
插件启动 (onload)
    ↓
SnippetLoader.loadFromFile()
    ↓
读取文件内容 (vault.read)
    ↓
SnippetParser.parseJson()
    ↓
验证和规范化片段
    ↓
SnippetBody.processSnippetBody()
    ↓
解析占位符、变量、选择项
    ↓
SnippetEngine.setSnippets()
    ↓
构建 Trie 树索引
    ↓
计算前缀长度范围
    ↓
完成加载，显示通知
```

### 2. 片段匹配和展开流程

```
用户输入文本
    ↓
触发键按下 (Tab/自定义)
    ↓
Keymap 捕获事件
    ↓
SnippetManager.expandSnippet()
    ↓
获取光标前文本 (PrefixContext)
    ↓
SnippetEngine.matchSnippetInContext()
    ↓
Trie 树查找匹配
    ↓
找到匹配片段
    ↓
SnippetManager.insertSnippet()
    ↓
VariableResolver 替换变量
    ↓
调整 TabStop 位置（考虑变量长度变化）
    ↓
editor.replaceRange() 插入文本
    ↓
SnippetSession.pushSnippetSession()
    ↓
创建 Session Entry
    ↓
聚焦第一个 TabStop
    ↓
TabStopPlaceholderStrategySelector.getStrategy() 选择占位符策略
    ↓
策略.onStopInitialized() 处理初始化事件
    ↓
Widget 系统渲染占位符高亮
    ↓
记录 usage（1s 防抖保存设置）
```

### 3. TabStop 跳转流程

```
用户按下跳转键 (Mod+Tab)
    ↓
SnippetManager.jumpToNextTabStop()
    ↓
获取当前 Session
    ↓
获取当前 TabStop
    ↓
TabStopJumpStrategySelector.getStrategy() 选择跳转策略
    ↓
策略.selectNext() 查找下一个 TabStop
    ↓
检查是否为 $0（退出条件）
    ↓
检查 TabStop 位置是否有效
    ↓
聚焦目标 TabStop
    ↓
TabStopPlaceholderStrategySelector.getStrategy() 选择占位符策略
    ↓
策略.onStopFocused() 处理聚焦事件
    ↓
更新 Session currentIndex
    ↓
Widget 系统更新装饰
    ↓
显示下一个 TabStop 的 Ghost Text
```

### 4. 补全菜单流程

```
用户触发菜单 (Ctrl+Shift+S / 自定义)
    ↓
SnippetCompletionMenu.open()
    ↓
提取查询上下文 (光标前文本)
    ↓
SnippetCompletionMenu.filterSnippets()
    ↓
前缀匹配 / 模糊匹配 / 描述匹配
    ↓
SnippetRankingPipeline.rankSnippets()
    ↓
应用排序算法（按配置顺序）
    ↓
渲染菜单列表
    ↓
显示预览面板
    ↓
用户选择片段
    ↓
SnippetManager.applySnippetAtCursor()
    ↓
插入片段并创建 Session
    ↓
记录 usage（1s 防抖保存设置）
    ↓
关闭菜单
```

### 5. 选择项循环流程

```
用户在包含选择项的 TabStop 中
    ↓
按下循环键 (Ctrl+Space / 自定义)
    ↓
SnippetManager.cycleChoiceAtCurrentStop()
    ↓
TabStopPlaceholderStrategySelector.getStrategy() 选择占位符策略
    ↓
策略.getSpecialActions() 获取可用操作
    ↓
策略.executeSpecialAction('cycleChoice') 执行循环操作
    ↓
查找当前文本在选择列表中的索引
    ↓
计算下一个索引（循环）
    ↓
替换文本
    ↓
更新选择
    ↓
Widget 更新选择项提示
```

---

## 设计模式分析

### 1. 单例模式 (Singleton Pattern)

**应用场景**：
- `PluginLogger`: 全局日志实例
- `SnippetWidgetConfig`: 全局配置对象

**优势**：
- 确保全局唯一实例
- 便于统一管理状态

**实现方式**：
```typescript
// Logger 通过构造函数创建，但通常只有一个实例
private logger = new PluginLogger();
```

### 2. 策略模式 (Strategy Pattern)

**应用场景**：
- **排序算法**：`SnippetRankingPipeline` 中的多种排序策略
- **变量解析**：`VariableResolver` 中不同变量的解析策略
- **TabStop 跳转**：`TabStopJumpStrategy` 处理不同跳转逻辑（标准、引用、函数）
- **TabStop 占位符**：`TabStopPlaceholderStrategy` 处理不同类型占位符的行为（标准、选择项、默认值）

**优势**：
- 算法可独立替换
- 易于扩展新算法
- 符合开闭原则
- 职责分离：跳转逻辑和占位符行为独立演化

**实现方式**：

1. **排序算法策略**：
```typescript
switch (algorithmId) {
    case "fuzzy-match": return compareFuzzy(...);
    case "prefix-length": return comparePrefixLength(...);
    // ...
}
```

2. **TabStop 跳转策略**：
```typescript
// 跳转策略接口
interface TabStopJumpStrategy {
    selectNext(session: SnippetSessionEntry, currentIndex: number): JumpCandidate | null;
    selectPrev(session: SnippetSessionEntry, currentIndex: number): JumpCandidate | null;
    matches(stop: SnippetSessionStop): boolean;
}

// 标准跳转策略
class StandardJumpStrategy implements TabStopJumpStrategy {
    // 基于 index 的简单查找逻辑
}

// 策略选择器
class TabStopJumpStrategySelector {
    getStrategy(stop: SnippetSessionStop): TabStopJumpStrategy {
        // 按优先级匹配: function > reference > standard
    }
}
```

3. **TabStop 占位符策略**：
```typescript
// 占位符策略接口
interface TabStopPlaceholderStrategy {
    onStopInitialized?(editor: Editor, stop: SnippetSessionStop): void;
    onStopFocused?(editor: Editor, stop: SnippetSessionStop): void;
    executeSpecialAction?(editor: Editor, stop: SnippetSessionStop, action: string): boolean;
    matches(stop: SnippetSessionStop): boolean;
}

// 选择项占位符策略
class ChoicePlaceholderStrategy implements TabStopPlaceholderStrategy {
    matches(stop: SnippetSessionStop): boolean {
        return !!(stop.choices && stop.choices.length > 0);
    }
    executeSpecialAction(editor: Editor, stop: SnippetSessionStop, action: string): boolean {
        // 处理 cycleChoice 操作
    }
}
```

### 3. 状态模式 (State Pattern)

**应用场景**：
- **SnippetSession**: 片段会话的不同状态（活跃/非活跃）
- **TabStop 跳转**: 不同 TabStop 索引的状态

**优势**：
- 状态转换逻辑清晰
- 易于维护和扩展

**实现方式**：
```typescript
// Session Entry 包含当前状态
interface SnippetSessionEntry {
    currentIndex: number;  // 当前状态
    stops: SnippetSessionStop[];
}
```

### 4. 观察者模式 (Observer Pattern)

**应用场景**：
- **CodeMirror ViewPlugin**: 监听文档和选择变化
- **事件监听**: 键盘事件、窗口事件

**优势**：
- 解耦事件源和处理器
- 支持多个观察者

**实现方式**：
```typescript
// ViewPlugin 观察文档变化
export const snippetSessionPlugin = ViewPlugin.fromClass(
    class {
        update(update: ViewUpdate) {
            // 响应变化
        }
    }
);
```

### 5. 工厂模式 (Factory Pattern)

**应用场景**：
- **Widget 创建**: `NextTabStopWidget`, `ChoiceHintWidget`
- **Extension 构建**: `buildTriggerKeymapExtension()`

**优势**：
- 封装对象创建逻辑
- 统一创建接口

**实现方式**：
```typescript
// Widget 工厂
new NextTabStopWidget(label, color)
new ChoiceHintWidget(hint, choices, ...)
```

### 6. 责任链模式 (Chain of Responsibility)

**应用场景**：
- **排序流水线**: 多个排序算法依次应用
- **片段匹配**: 从最短到最长尝试匹配

**优势**：
- 请求在链中传递
- 每个处理器决定是否处理或传递

**实现方式**：
```typescript
// 排序责任链
for (const algorithm of enabledAlgorithms) {
    const comparison = compareByAlgorithm(...);
    if (comparison !== 0) return comparison;
}
```

### 7. 适配器模式 (Adapter Pattern)

**应用场景**：
- **EditorUtils**: 适配 Obsidian Editor 和 CodeMirror EditorView
- **设置迁移**: 旧版本设置的兼容处理

**优势**：
- 解决接口不兼容问题
- 保持向后兼容

### 8. 模板方法模式 (Template Method Pattern)

**应用场景**：
- **片段处理流程**: 固定的处理步骤，具体实现可变化
- **菜单更新流程**: 固定的更新步骤

**优势**：
- 定义算法骨架
- 子步骤可变化

### 9. 装饰器模式 (Decorator Pattern)

**应用场景**：
- **CodeMirror Decoration**: 为文本添加视觉装饰
- **Widget 装饰**: 在特定位置添加装饰元素

**优势**：
- 动态添加功能
- 不修改原有结构

---

## 关键技术点

### 1. Trie 树前缀匹配

**数据结构**：
```typescript
interface TrieNode {
    children: Map<string, TrieNode>;
    snippet?: ParsedSnippet;
}
```

**构建过程**：
1. 遍历所有片段的前缀字符串
2. 按字符逐层构建树结构
3. 在叶子节点存储完整片段

**匹配算法**：
```typescript
// 时间复杂度：O(m)，m 为前缀长度
function findByPrefix(prefix: string): ParsedSnippet | undefined {
    let node = this.trie;
    for (const char of prefix) {
        const next = node.children.get(char);
        if (!next) return undefined;
        node = next;
    }
    return node.snippet;
}
```

**优势**：
- 匹配速度快（O(m)）
- 支持前缀查询
- 内存占用相对较小

**匹配策略**：
- 从光标位置向前提取文本
- 从最短子串开始尝试匹配
- 命中即返回（偏好离光标最近的短前缀，而非最长匹配）

### 2. TabStop 策略模式实现

**双策略架构**：
- **跳转策略** (`TabStopJumpStrategy`)：处理如何找到下一个/上一个 TabStop
- **占位符策略** (`TabStopPlaceholderStrategy`)：处理不同类型的 TabStop 行为

**策略选择机制**：
```typescript
// 跳转策略选择：按优先级匹配
const jumpStrategy = jumpStrategySelector.getStrategy(stop);
const candidate = jumpStrategy.selectNext(session, currentIndex);

// 占位符策略选择：按特异性匹配
const placeholderStrategy = placeholderStrategySelector.getStrategy(stop);
placeholderStrategy.onStopFocused?.(editor, stop);
```

**优势**：
- 职责分离：跳转逻辑和占位符行为独立演化
- 易于扩展：新增 TabStop 类型只需添加新策略
- 组合使用：一个 stop 可同时使用两种策略
- 符合开闭原则：对扩展开放，对修改关闭

**当前实现**：
- `StandardJumpStrategy`：标准跳转（所有 stop）
- `StandardPlaceholderStrategy`：标准占位符（fallback，包括默认值占位符）
- `ChoicePlaceholderStrategy`：选择项占位符（有 choices 的 stop）

**默认值占位符实现说明**：
- `${1:defaultText}` 格式已支持，默认文本在解析时直接插入到处理后的文本中
- TabStop 的 start/end 位置包含默认文本，聚焦时默认文本已被选中
- 使用 `StandardPlaceholderStrategy`，因为默认文本已作为初始内容，无需特殊处理

**已实现策略**：
- `StandardJumpStrategy`：标准跳转（所有 stop 的默认策略）
- `ReferenceJumpStrategy`：引用类型 stop 的跳转（已实现，支持多位置同步）

**未来扩展**：
- `FunctionJumpStrategy`：函数 snippet（管道语法，如 `${1|>upcase|>regex}`）
- 如果需要区分默认值和用户输入，可添加 `DefaultValuePlaceholderStrategy`

### 4. CodeMirror 扩展机制

**StateField**：
- 用于存储片段会话状态
- 自动处理文档变更的位置映射
- 通过 Effect 更新状态

**ViewPlugin**：
- 监听文档和选择变化
- 动态更新装饰集
- 响应式渲染

**Decoration System**：
- `Decoration.mark()`: 文本标记（占位符高亮）
- `Decoration.widget()`: 插入 Widget（提示文本）
- `DecorationSet`: 装饰集合管理

**Extension 组合**：
```typescript
export const snippetSessionExtensions: Extension[] = [
    snippetSessionField,
    snippetSessionPlugin
];
```

### 5. 状态管理机制

**状态存储**：
- 使用 CodeMirror 的 StateField 存储会话栈
- 状态与文档绑定，自动同步

**状态更新**：
- 通过 StateEffect 触发更新
- 使用 `view.dispatch()` 应用变更

**位置映射**：
```typescript
// 文档变更时自动映射位置
const mapStops = (stops: SnippetSessionStop[], change: ChangeDesc) =>
    stops.map(stop => ({
        ...stop,
        start: change.mapPos(stop.start, -1),
        end: change.mapPos(stop.end, 1),
    }));
```

**状态持久化**：
- 会话状态仅在内存中（编辑器状态）
- 插件设置持久化到 Obsidian 配置

### 6. 片段语法解析

**语法规则**：
- `$1`, `$2`: 简单占位符
- `${1}`: 带花括号的占位符
- `${1:default}`: 带默认值的占位符
- `${1|a,b,c|}`: 选择列表
- `${VAR}`: 变量引用
- `${VAR:default}`: 带默认值的变量
- `$$`: 转义的美元符号
- `\$`, `\{`, `\}`: 转义字符

**解析算法**：
- 使用递归下降解析器
- 状态机处理复杂语法
- 维护位置信息用于 TabStop 定位

**关键挑战**：
- 嵌套占位符的处理
- 转义字符的正确识别
- 位置计算的准确性

### 7. 变量替换机制

**替换流程**：
1. 解析变量位置和默认值
2. 按位置排序变量
3. 从后向前替换（避免位置偏移）
4. 计算长度差异
5. 调整后续 TabStop 位置

**位置调整算法**：
```typescript
let delta = 0;
for (const variable of sortedVariables) {
    const diff = replacement.length - originalLength;
    if (diff !== 0) {
        // 调整所有受影响的 TabStop
        updatedStops.forEach(stop => {
            if (stop.start >= variable.end) {
                stop.start += diff;
                stop.end += diff;
            }
        });
        delta += diff;
    }
}
```

### 8. 排序算法实现

**多策略排序**：
- 按配置顺序依次应用算法
- 如果两个元素在某算法下相等，使用下一个算法
- 所有算法都相等时，使用稳定回退

**模糊匹配算法**：
```typescript
function getFuzzyScore(prefix: string, query: string): number {
    if (prefix === query) return 0;           // 精确匹配
    if (prefix.startsWith(query)) return 1;  // 前缀匹配
    const index = prefix.indexOf(query);
    if (index >= 0) return 10 + index;        // 包含匹配
    return 1000 + prefix.length;              // 无匹配
}
```

**稳定性保证**：
- 使用原始索引作为最终 tiebreaker
- 确保相同输入产生相同输出

### 9. 性能优化策略

**Trie 树索引**：
- 前缀匹配从 O(n) 优化到 O(m)
- 减少不必要的字符串比较

**延迟计算**：
- 片段体解析延迟到实际使用时
- 变量替换仅在插入时执行

**防抖机制**：
- 使用频率保存使用 1 秒防抖
- 减少不必要的磁盘写入

**装饰更新优化**：
- 仅在必要时重新计算装饰
- 使用 RangeSetBuilder 高效构建装饰集

---

## 总结

ObVsnip 项目采用了清晰的模块化架构，通过合理的职责分离和设计模式应用，实现了一个功能完整、性能优良的代码片段插件。主要特点包括：

1. **高效的前缀匹配**：基于 Trie 树的 O(m) 匹配算法
2. **完整的语法支持**：符合 VSCode 片段规范
3. **灵活的排序系统**：可配置的多策略排序
4. **优雅的状态管理**：基于 CodeMirror 6 的状态系统
5. **丰富的交互功能**：TabStop 跳转、选择项、补全菜单等

项目代码质量高，类型安全，易于维护和扩展。

