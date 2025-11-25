<!-- 505cfb56-9023-4f85-bae7-486d0eafd613 4e9ce067-2abe-4c5c-bd3a-0e1e6e6010f9 -->
# TabStop 跳转策略模式设计文档

> **状态说明**：本文档描述了策略模式的设计思路和实施计划。
> - ✅ **阶段 1**（基础重构）：已完成
> - ✅ **阶段 2**（引用 Snippet 支持）：已完成
> - ⏳ **阶段 3**（函数 Snippet 支持）：未实现

## 当前实现分析
### 功能需求状态

1. **引用 Snippet** (`$1` 多处使用) ✅ **已实现**

   - ✅ 同一 index 需要关联多个 stop 位置
   - ✅ 编辑其中一个时,其他位置同步更新
   - ✅ 同步机制: 实时同步(编辑时立即同步) / 跳转同步(跳转时同步)
   - ✅ 通过设置选项控制同步方式
   - 📖 详细实现见 [实时同步机制文档](./realtime-sync.md)

2. **函数 Snippet** (`${1|>upcase|>regex}`) ⏳ **未实现**

   - ⏳ 管道语法支持
   - ⏳ 函数执行时机(跳转时/编辑时)
   - ⏳ 通过设置选项控制启用/禁用

## 策略模式适用性评估

### 关键设计决策: 双策略模式 + 按 Tab Stop 级别选择策略

**为什么采用双策略模式?**

- **职责分离**: 跳转策略解决"导航"问题，占位符策略解决"行为"问题
- **独立演化**: 两种策略可以独立扩展，互不影响
- **组合使用**: 一个 stop 可以同时使用跳转策略和占位符策略
  - 例如: Choice tabstop 使用 `StandardJumpStrategy`（标准跳转）+ `ChoicePlaceholderStrategy`（choice 行为）

### 优势

✅ **扩展性强**: 新增 stop 类型只需添加新策略,无需修改核心逻辑

✅ **职责分离**: 不同跳转行为封装在独立策略中

✅ **灵活组合**: 同一 snippet 可混合使用多种策略

✅ **易于测试**: 每个策略可独立测试

✅ **符合开闭原则**: 对扩展开放,对修改关闭

### 需要重构的部分

1. **数据结构**: `TabStopInfo` 和 `SnippetSessionStop` 需要支持:
   - 同一 index 的多个位置(引用 snippet)
   - 函数元数据(函数 snippet)
   - stop 类型标识

2. **跳转逻辑**: `selectNextTabStop`/`selectPrevTabStop` 改为按 stop 类型选择跳转策略
3. **占位符行为**: 不同类型的 stop 行为封装到占位符策略中
   - Choice tabstop 的 `cycleChoiceAtCurrentStop()` 逻辑
   - 默认值 tabstop 的初始化行为（已实现，默认文本直接插入）
4. **同步机制**: 引用 snippet 的实时/跳转同步(可配置)
5. **函数执行**: 函数 snippet 的管道处理
6. **设置选项**: 在 `SettingsTab` 中添加控制选项

## 推荐设计方案：双策略模式

### 1. 跳转策略接口设计（Jump Strategy）

**关注点**: 如何找到下一个/上一个 tabstop

```typescript
interface TabStopJumpStrategy {
    // 选择下一个 stop
    selectNext(session: SnippetSessionEntry, currentIndex: number): JumpCandidate | null;
    // 选择上一个 stop
    selectPrev(session: SnippetSessionEntry, currentIndex: number): JumpCandidate | null;
    // 判断 stop 是否使用此策略
    matches(stop: SnippetSessionStop): boolean;
}
```

### 2. 占位符策略接口设计（Placeholder Strategy）

**关注点**: 不同类型的 tabstop 节点如何表现（初始化、聚焦、编辑、特殊操作）

```typescript
interface TabStopPlaceholderStrategy {
    // 初始化时调用（snippet 插入后）
    onStopInitialized?(editor: Editor, stop: SnippetSessionStop): void;
    // 聚焦到 stop 时调用
    onStopFocused?(editor: Editor, stop: SnippetSessionStop): void;
    // stop 被编辑时的回调(用于同步更新)
    onStopEdited?(editor: Editor, stop: SnippetSessionStop, newText: string, settings: PluginSettings): void;
    // 判断 stop 是否使用此策略
    matches(stop: SnippetSessionStop): boolean;
    // 获取特殊操作（如 cycleChoice）
    getSpecialActions?(stop: SnippetSessionStop): string[];
    // 执行特殊操作
    executeSpecialAction?(editor: Editor, stop: SnippetSessionStop, action: string): boolean;
}
```

### 3. 跳转策略实现

- **StandardJumpStrategy**: 当前的标准跳转行为(默认策略)
  - 匹配所有 stop
  - 基于 index 的简单查找逻辑
- **ReferenceJumpStrategy**: 引用 snippet,支持多位置同步（阶段二）
  - 根据设置选择实时同步或跳转同步
- **FunctionJumpStrategy**: 函数 snippet,支持管道语法（阶段三）
  - 根据设置决定是否启用

### 4. 占位符策略实现

- **StandardPlaceholderStrategy**: 默认占位符行为
  - 匹配所有 stop（作为 fallback）
  - 标准初始化、聚焦行为
- **ChoicePlaceholderStrategy**: Choice tabstop 行为（阶段一）
  - 匹配有 `choices` 属性的 stop
  - 封装 `cycleChoiceAtCurrentStop()` 逻辑
  - 在 `onStopFocused` 中显示 choice hint widget（UI 部分在 snippetSession.ts 中）
- **默认值占位符处理**（已实现，使用 StandardPlaceholderStrategy）：
  - `${1:defaultText}` 格式已支持
  - 默认文本在解析时直接插入到 `processedText` 中
  - TabStop 的 start/end 位置包含默认文本
  - 聚焦时默认文本已被选中，无需特殊策略处理
  - 当前使用 `StandardPlaceholderStrategy`（因为默认文本已作为初始内容）

### 5. 数据结构扩展

```typescript
interface TabStopInfo {
    index: number;
    start: number;
    end: number;
    choices?: string[];
    // 新增字段（阶段二、三）
    type?: 'standard' | 'reference' | 'function';  // stop 类型
    referenceGroup?: string;  // 引用组标识(相同 index 的 stops 共享)
    functions?: string[];      // 管道函数列表 ['upcase', 'regex']
    defaultValue?: string;      // 默认值文本（当前实现：默认文本直接插入到 text 中，不单独存储）
}
```

### 6. 策略选择机制

**跳转策略选择器**:
```typescript
class TabStopJumpStrategySelector {
    private strategies: TabStopJumpStrategy[];
    
    getStrategy(stop: SnippetSessionStop, settings: PluginSettings): TabStopJumpStrategy {
        // 按优先级匹配: function > reference > standard
        for (const strategy of this.strategies) {
            if (strategy.matches(stop)) {
                // 检查设置是否启用
                if (this.isStrategyEnabled(strategy, stop, settings)) {
                    return strategy;
                }
            }
        }
        return this.defaultStrategy;
    }
}
```

**占位符策略选择器**:
```typescript
class TabStopPlaceholderStrategySelector {
    private strategies: TabStopPlaceholderStrategy[];
    
    getStrategy(stop: SnippetSessionStop, settings: PluginSettings): TabStopPlaceholderStrategy {
        // 按特异性匹配: choice > default > standard
        for (const strategy of this.strategies) {
            if (strategy.matches(stop)) {
                return strategy;
            }
        }
        return this.defaultStrategy;
    }
}
```

### 5. 设置选项设计

在 `PluginSettings` 中添加:

```typescript
interface PluginSettings {
    // ... 现有字段
    // 引用 snippet 设置
    referenceSnippetEnabled: boolean;
    referenceSyncMode: 'realtime' | 'on-jump';  // 实时同步 / 跳转同步
    // 函数 snippet 设置
    functionSnippetEnabled: boolean;
}
```

在 `SettingsTab` 中添加 UI:

- 引用 snippet 开关
- 同步模式选择(实时/跳转)
- 函数 snippet 开关

## 实施建议

### 阶段 1: 基础重构(不破坏现有功能) - 双策略模式 ✅ **已完成**

**跳转策略部分**:
1. ✅ 创建 `TabStopJumpStrategy` 接口
2. ✅ 实现 `StandardJumpStrategy`（封装当前跳转逻辑）
3. ✅ 创建 `TabStopJumpStrategySelector` 策略选择器
4. ✅ 重构 `SnippetManager.selectNextTabStop`/`selectPrevTabStop` 使用跳转策略

**占位符策略部分**:
5. ✅ 创建 `TabStopPlaceholderStrategy` 接口
6. ✅ 实现 `StandardPlaceholderStrategy`（默认行为）
7. ✅ 实现 `ChoicePlaceholderStrategy`（封装 `cycleChoiceAtCurrentStop` 逻辑）
8. ✅ 创建 `TabStopPlaceholderStrategySelector` 策略选择器
9. ✅ 重构 `SnippetManager.cycleChoiceAtCurrentStop()` 使用占位符策略
10. ✅ 在 `insertSnippet()` 中，初始化时调用占位符策略的 `onStopInitialized`

**集成与测试**:
11. ✅ `SnippetManager` 同时使用两种策略选择器
12. ✅ 确保所有测试通过

### 阶段 2: 引用 Snippet 支持 ✅ **已完成**

1. ✅ 扩展 `TabStopInfo` 和 `SnippetSessionStop` 支持多位置
2. ✅ 更新 `snippetBody.ts` 解析器识别引用语法
3. ✅ 实现 `ReferenceJumpStrategy`
4. ✅ 实现同步更新机制(实时/跳转两种模式)
5. ✅ 在 `SettingsTab` 中添加设置选项
6. ✅ 更新 `PluginSettings` 和 `defaults.ts`

### 阶段 3: 函数 Snippet 支持 ⏳ **未实现**

1. ⏳ 实现函数执行引擎 `FunctionExecutor`
2. ⏳ 实现 `FunctionJumpStrategy`
3. ⏳ 更新解析器支持管道语法 `${1|>upcase|>regex}`
4. ⏳ 添加内置函数注册机制
5. ⏳ 在 `SettingsTab` 中添加设置选项
6. ⏳ 更新 `PluginSettings` 和 `defaults.ts`

## 关键技术点

### 引用 Snippet 同步机制

- **实时同步**: 监听编辑器变更事件,检测到 stop 编辑时立即同步所有相同 index 的位置
- **跳转同步**: 在 `jumpToNextTabStop` 时,将当前 stop 的内容同步到所有相同 index 的位置
- 使用 CodeMirror 的 `EditorView.update` 监听文档变化

### 函数 Snippet 执行

- 管道函数按顺序执行: `input |> upcase |> regex`
- 函数注册表: `FunctionRegistry`
- 内置函数: `upcase`, `downcase`, `capitalize`, `regex` 等
- 可扩展的函数接口

## 风险评估

⚠️ **兼容性**: 需要确保现有 snippet 继续工作(默认使用 StandardJumpStrategy 和 StandardPlaceholderStrategy)

⚠️ **性能**: 引用 snippet 的实时同步可能影响性能,需要优化

⚠️ **复杂度**: 双策略模式增加了架构复杂度,需要清晰的设计文档和代码组织

⚠️ **测试**: 需要为每种策略编写完整测试,包括策略组合的场景

⚠️ **Choice TabStop**: 当前 choice tabstop 的跳转逻辑与普通 tabstop 相同,统一使用 StandardJumpStrategy; 其特殊行为通过 ChoicePlaceholderStrategy 处理