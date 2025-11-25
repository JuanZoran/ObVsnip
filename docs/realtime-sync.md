# 实时同步更新机制文档

## 目录

1. [概述](#概述)
2. [核心机制](#核心机制)
3. [实现架构](#实现架构)
4. [同步流程](#同步流程)
5. [代码关键点](#代码关键点)

---

## 概述

### 实时同步的定义和用途

实时同步是 ObVsnip 插件中用于处理**引用类型 TabStop**（Reference TabStop）的同步更新机制。当用户在编辑器中修改一个引用 TabStop 的内容时，插件会自动将相同的修改同步到所有关联的引用 TabStop 位置。

**引用 TabStop 示例**：
```json
{
  "prefix": "func",
  "body": "function ${1:name}() {\n  return ${1};\n}"
}
```

在这个例子中，`${1:name}` 和 `${1}` 是同一个引用组，当用户修改第一个 `name` 时，第二个 `${1}` 的位置会自动更新为相同的内容。

### 支持的同步模式

插件支持两种同步模式，用户可以在设置中选择：

1. **实时同步（realtime）**：用户在编辑时立即同步所有关联的引用 TabStop
   - 优点：即时反馈，用户体验流畅
   - 适用场景：需要实时看到同步效果的场景

2. **跳转同步（on-jump）**：仅在跳转到下一个 TabStop 时进行同步
   - 优点：性能更好，减少频繁更新
   - 适用场景：对性能敏感或不需要实时同步的场景

配置位置：`src/config/defaults.ts` 中默认值为 `'realtime'`

```typescript
referenceSyncMode: 'realtime' | 'on-jump';
```

---

## 核心机制

### CodeMirror ViewPlugin 监听机制

实时同步的核心依赖于 CodeMirror 6 的 `ViewPlugin` 机制。`ViewPlugin` 是 CodeMirror 提供的视图层插件系统，可以监听编辑器状态的变化。

**关键组件**：`snippetSessionPlugin`（位于 `src/snippetSession.ts`）

```typescript
export const snippetSessionPlugin = ViewPlugin.fromClass(
  class {
    update(update: ViewUpdate) {
      // 监听文档变化、选择变化、会话变化
      const docChanged = update.docChanged;
      const selectionChanged = update.selectionSet;
      const sessionChanged = update.startState.field(snippetSessionField) !== 
                            update.state.field(snippetSessionField);
      
      // 处理实时同步逻辑
      if (docChanged && realtimeSyncCallback && !sessionChanged) {
        // 触发同步回调
      }
    }
  }
);
```

### 文档变化检测

`ViewPlugin.update()` 方法会在以下情况被调用：
- 文档内容发生变化（`docChanged`）
- 选择区域发生变化（`selectionChanged`）
- 会话状态发生变化（`sessionChanged`）

实时同步机制主要关注 `docChanged` 事件，当检测到文档变化时：
1. 检查当前是否处于 snippet 会话中
2. 检查当前 TabStop 是否为引用类型
3. 检查变化是否发生在当前 TabStop 范围内
4. 如果满足条件，触发同步回调

### 引用 TabStop 识别

引用 TabStop 通过以下属性识别：

```typescript
interface SnippetSessionStop {
  index: number;
  start: number;
  end: number;
  type?: 'standard' | 'reference' | 'function';
  referenceGroup?: string;  // 引用组标识
  linkedStops?: number[];    // 关联的 stop 索引
}
```

- `type === 'reference'`：标识为引用类型
- `referenceGroup`：相同引用组的 TabStop 共享同一个标识
- `linkedStops`：存储同一引用组中其他 stop 的索引

---

## 实现架构

### snippetSession.ts: ViewPlugin 和状态管理

**职责**：
- 管理 snippet 会话状态（通过 `StateField`）
- 监听编辑器变化（通过 `ViewPlugin`）
- 提供实时同步回调机制

**关键代码结构**：

```typescript
// 1. 定义实时同步回调类型
type RealtimeSyncCallback = (
  view: EditorView, 
  session: SnippetSessionEntry, 
  currentStop: SnippetSessionStop
) => void;

// 2. 回调注册机制
let realtimeSyncCallback: RealtimeSyncCallback | null = null;
export const setRealtimeSyncCallback = (callback: RealtimeSyncCallback | null): void => {
  realtimeSyncCallback = callback;
};

// 3. ViewPlugin 中的变化检测
update(update: ViewUpdate) {
  if (docChanged && realtimeSyncCallback && !sessionChanged) {
    // 检测是否为引用 TabStop 的编辑
    // 触发同步回调
  }
}
```

**位置映射机制**：

当文档发生变化时，CodeMirror 会自动映射位置，但插件需要确保 TabStop 的位置信息保持同步：

```typescript
const mapStops = (stops: SnippetSessionStop[], change: ChangeDesc): SnippetSessionStop[] =>
  stops.map(stop => ({
    ...stop,
    start: change.mapPos(stop.start, -1),
    end: change.mapPos(stop.end, 1),
  }));
```

### snippetManager.ts: 同步逻辑和回调处理

**职责**：
- 注册实时同步回调函数
- 实现实际的同步逻辑
- 处理文本更新和位置调整

**回调注册**（`registerRealtimeSyncCallback` 方法）：

```typescript
private registerRealtimeSyncCallback(): void {
  setRealtimeSyncCallback((view, session, currentStop) => {
    const settings = this.options?.getSettings?.();
    // 检查是否启用实时同步
    if (!settings?.referenceSnippetEnabled || 
        settings.referenceSyncMode !== 'realtime') {
      return;
    }
    
    // 执行同步逻辑
    const updatedStops = this.syncReferenceStops(
      editor, currentStop, latestSession, 'realtime'
    );
    
    // 更新会话状态
    if (updatedStops) {
      view.dispatch({
        effects: replaceSnippetSessionEffect.of(updatedSession),
      });
    }
  });
}
```

**同步实现**（`syncReferenceStops` 方法）：

这是同步机制的核心实现，负责：
1. 读取当前 TabStop 的实际文本内容
2. 找到所有关联的引用 TabStop
3. 批量更新所有关联位置的文本
4. 重新计算并更新所有 TabStop 的位置信息

### 回调注册机制

回调注册采用全局单例模式：

1. **初始化阶段**：`SnippetManager` 构造函数中调用 `registerRealtimeSyncCallback()`
2. **注册回调**：通过 `setRealtimeSyncCallback()` 设置回调函数
3. **触发时机**：`ViewPlugin.update()` 检测到变化时调用回调
4. **执行同步**：回调函数中执行实际的同步逻辑

这种设计的优势：
- 解耦：`snippetSession.ts` 只负责检测，不关心具体同步逻辑
- 灵活：可以动态替换回调函数
- 可测试：回调函数可以独立测试

---

## 同步流程

### 文档变化检测流程

```
用户输入
  ↓
CodeMirror 处理输入
  ↓
ViewPlugin.update() 被调用
  ↓
检查: docChanged && realtimeSyncCallback && !sessionChanged
  ↓
检查: 当前 stop 是否为 reference 类型
  ↓
检查: 变化是否发生在当前 stop 范围内
  ↓
触发 realtimeSyncCallback
```

### 实时同步触发条件

同步回调仅在满足以下**所有条件**时才会触发：

1. **文档发生变化**（`docChanged === true`）
2. **已注册同步回调**（`realtimeSyncCallback !== null`）
3. **会话未变化**（`!sessionChanged`）- 避免在会话更新时触发
4. **当前 TabStop 为引用类型**（`currentStop.type === 'reference'`）
5. **变化发生在当前 TabStop 范围内**（通过位置检查）
6. **配置启用实时同步**（`settings.referenceSyncMode === 'realtime'`）

**位置检查逻辑**：

```typescript
// 检查变化是否与当前 stop 重叠
changes.iterChanges((fromA, toA, fromB, toB) => {
  const changeOverlaps = 
    (fromA >= oldCurrentStop.start && fromA < oldCurrentStop.end) ||
    (toA > oldCurrentStop.start && toA <= oldCurrentStop.end) ||
    (fromA <= oldCurrentStop.start && toA >= oldCurrentStop.end);
  
  // 边界情况：在 stop 边界输入
  const changeAtBoundary = 
    (fromA === oldCurrentStop.end || toA === oldCurrentStop.end) &&
    selectionInStop;
});
```

### 文本同步和位置更新

同步过程分为以下几个步骤：

#### 1. 读取当前文本

```typescript
// 确定实际文本范围（考虑用户输入可能超出原 stop.end）
let actualStart = currentStop.start;
let actualEnd = currentStop.end;

// 如果选择在当前 stop 范围内，使用选择结束位置
if (selection.from >= currentStop.start) {
  actualEnd = Math.max(selection.to, currentStop.end);
}

// 从 CodeMirror 文档状态读取文本（更准确）
const currentText = view.state.doc.sliceString(actualStart, actualEnd);
```

#### 2. 查找关联的引用 TabStop

```typescript
// 通过 linkedStops 数组找到所有关联的 stop
for (const linkedIndex of currentStop.linkedStops) {
  const linkedStop = session.stops[linkedIndex];
  if (linkedStop && linkedStop.type === 'reference') {
    // 检查是否需要更新
    const linkedText = view.state.doc.sliceString(linkedStop.start, linkedStop.end);
    if (linkedText !== currentText) {
      updates.push({ from, to, text: currentText, linkedIndex });
    }
  }
}
```

#### 3. 批量应用更新

```typescript
// 使用 CodeMirror Transaction 原子性更新
view.dispatch({
  changes: changes,  // 所有更改一次性应用
  annotations: [Transaction.userEvent.of('snippet-sync')],  // 标记为同步操作
});
```

#### 4. 更新位置信息

由于文本长度可能变化，需要重新计算所有 TabStop 的位置：

```typescript
// 计算位置调整量
const updateDiffs = updates.map(update => ({
  position: update.from,
  diff: newLength - oldLength,
  linkedIndex: update.linkedIndex,
}));

// 应用累积调整到所有后续 stop
for (let i = 0; i < updatedStops.length; i++) {
  let cumulativeAdjustment = 0;
  for (const updateDiff of updateDiffs) {
    if (updateDiff.position < originalStop.start) {
      cumulativeAdjustment += updateDiff.diff;
    }
  }
  // 更新 stop 位置
  updatedStops[i] = {
    ...stop,
    start: originalStart + cumulativeAdjustment,
    end: originalEnd + cumulativeAdjustment,
  };
}
```

### 防止循环同步的机制

为了防止同步操作本身触发新的同步（导致无限循环），插件采用了以下机制：

1. **事务标记**：同步操作使用特殊的事务标记

```typescript
view.dispatch({
  changes: changes,
  annotations: [Transaction.userEvent.of('snippet-sync')],  // 标记
});
```

2. **检测标记**：在 `ViewPlugin.update()` 中检查标记

```typescript
const isSnippetSync = update.transactions.some(tr => 
  tr.annotation(Transaction.userEvent) === 'snippet-sync'
);
if (isSnippetSync) {
  return;  // 跳过，不触发同步
}
```

3. **会话变化检查**：确保只在会话未变化时触发

```typescript
if (docChanged && realtimeSyncCallback && !sessionChanged) {
  // 只有在会话未变化时才触发
}
```

---

## 代码关键点

### 关键函数和类说明

#### 1. `snippetSessionPlugin` (ViewPlugin)

**位置**：`src/snippetSession.ts:328-448`

**作用**：监听编辑器变化，触发实时同步回调

**关键逻辑**：
- 在 `update()` 方法中检测文档变化
- 判断是否为引用 TabStop 的编辑
- 使用 `setTimeout` 延迟执行回调以避免嵌套更新错误
- 调用注册的回调函数

**延迟执行机制**：
由于在 `ViewPlugin.update()` 中直接调用 `view.dispatch()` 会导致嵌套更新错误，同步回调使用 `setTimeout(..., 0)` 延迟到下一个事件循环执行，确保 CodeMirror 完成当前更新周期。

#### 2. `setRealtimeSyncCallback()` / `getRealtimeSyncCallback()`

**位置**：`src/snippetSession.ts:52-56`

**作用**：管理全局实时同步回调函数

**使用方式**：
```typescript
// 注册回调
setRealtimeSyncCallback((view, session, currentStop) => {
  // 执行同步逻辑
});

// 获取回调（用于测试）
const callback = getRealtimeSyncCallback();
```

#### 3. `registerRealtimeSyncCallback()`

**位置**：`src/snippetManager.ts:54-88`

**作用**：`SnippetManager` 初始化时注册同步回调

**调用时机**：`SnippetManager` 构造函数中

**关键实现**：
- 使用 `findEditorByView()` 辅助函数查找对应的 Editor 实例
- 从 ViewPlugin 获取最新的会话状态
- 调用 `syncReferenceStops()` 执行同步

#### 4. `syncReferenceStops()`

**位置**：`src/snippetManager.ts:880-1000+`

**作用**：执行实际的同步逻辑

**参数**：
- `editor`: 编辑器实例
- `currentStop`: 当前被编辑的 TabStop
- `session`: 当前会话
- `mode`: 同步模式（'realtime' | 'on-jump'）

**返回值**：更新后的 stops 数组，如果无需更新则返回 `null`

### 重要代码片段解析

#### 片段 1: 变化检测和触发

```typescript
// src/snippetSession.ts:338-421
if (docChanged && realtimeSyncCallback && !sessionChanged) {
  // 跳过同步操作本身触发的变化
  const isSnippetSync = update.transactions.some(tr => 
    tr.annotation(Transaction.userEvent) === 'snippet-sync'
  );
  if (isSnippetSync) {
    return;
  }
  
  const stack = update.state.field(snippetSessionField);
  if (stack && stack.length > 0) {
    const session = stack[stack.length - 1];
    if (session.currentIndex >= 0) {
      const currentStop = session.stops.find(
        (stop) => stop.index === session.currentIndex
      );
      
      // 检查是否为引用类型且被编辑
      if (currentStop && currentStop.type === 'reference') {
        // 检查变化是否在当前 stop 范围内
        // ... 位置检查逻辑 ...
        
        if (changeInCurrentStop && realtimeSyncCallback) {
          realtimeSyncCallback(update.view, session, currentStop);
        }
      }
    }
  }
}
```

**解析**：
- 首先检查是否满足基本条件（文档变化、有回调、会话未变化）
- 检查是否为同步操作本身（防止循环）
- 获取当前会话和当前 TabStop
- 检查是否为引用类型
- 检查变化位置
- 触发回调

#### 片段 2: 文本范围确定

```typescript
// src/snippetManager.ts:calculateActualTextRange() 方法
// 确定实际文本范围（已提取为独立方法）
const { actualStart, actualEnd, text: currentText } = this.calculateActualTextRange(currentStop, view);

// 当用户输入时，光标/选择位置指示实际文本结束位置
if (selection.from >= currentStop.start) {
  // 选择在当前 stop 开始位置之后 - 使用选择结束位置
  actualEnd = Math.max(selection.to, currentStop.end);
} else if (selection.to > currentStop.start) {
  // 选择开始位置在 stop 之前但延伸到 stop 内
  actualEnd = Math.max(selection.to, currentStop.end);
}

// 确保不超过文档长度
const docLength = view.state.doc.length;
actualEnd = Math.min(actualEnd, docLength);

// 从 CodeMirror 文档状态读取文本（比 editor.getRange 更准确）
const currentText = view.state.doc.sliceString(actualStart, actualEnd);
```

**解析**：
- 需要考虑用户输入可能超出原 `stop.end` 位置
- 使用选择位置来确定实际文本范围
- 从 CodeMirror 文档状态读取，确保获取最新内容

#### 片段 3: 原子性批量更新

```typescript
// src/snippetManager.ts:880-897
// 构建所有更改
const changes: Array<{ from: number; to: number; insert: string }> = [];
for (const update of updates) {
  changes.push({
    from: update.from,
    to: update.to,
    insert: update.text,
  });
}

// 一次性应用所有更改（原子操作）
view.dispatch({
  changes: changes,
  annotations: [Transaction.userEvent.of('snippet-sync')],
});
```

**解析**：
- 收集所有需要更新的位置
- 使用 `view.dispatch()` 一次性应用所有更改
- 添加事务标记，防止触发新的同步

#### 片段 4: 位置调整计算

```typescript
// src/snippetManager.ts:907-968
// 计算每个更新对后续位置的影响
const updateDiffs = updates.map(update => {
  const oldLength = update.to - update.from;
  const newLength = update.text.length;
  return {
    position: update.from,
    diff: newLength - oldLength,
    linkedIndex: update.linkedIndex,
    newLength,
  };
});

// 对每个 stop 计算累积调整
for (let i = 0; i < updatedStops.length; i++) {
  const originalStop = session.stops[i];
  let cumulativeAdjustment = 0;
  
  // 累加所有在此 stop 之前的更新带来的位置变化
  for (const updateDiff of updateDiffs) {
    if (updateDiff.position < originalStop.start) {
      cumulativeAdjustment += updateDiff.diff;
    }
  }
  
  // 应用调整
  if (cumulativeAdjustment !== 0) {
    updatedStops[i] = {
      ...stop,
      start: originalStop.start + cumulativeAdjustment,
      end: originalStop.end + cumulativeAdjustment,
    };
  }
}
```

**解析**：
- 计算每个文本更新带来的长度变化（diff）
- 对于每个 TabStop，累加所有在它之前的更新带来的位置调整
- 更新所有受影响 stop 的位置信息

### 跳转同步模式

除了实时同步，插件还支持跳转同步模式（`on-jump`）。跳转同步在 `completeNextJumpTransition()` 方法中实现：

```typescript
// src/snippetManager.ts:617-640
// 在跳转前同步引用 stops（如果是 on-jump 模式）
if (previousStop && previousStop.type === 'reference') {
  const settings = this.options?.getSettings?.();
  if (settings?.referenceSnippetEnabled && 
      settings.referenceSyncMode === 'on-jump') {
    updatedStops = this.syncReferenceStops(
      editor, previousStop, session, 'on-jump'
    );
    // 更新会话状态
    if (updatedStops) {
      const updatedSession = { ...session, stops: updatedStops };
      view.dispatch({
        effects: replaceSnippetSessionEffect.of(updatedSession),
      });
    }
  }
}
```

**区别**：
- 实时同步：在 `ViewPlugin.update()` 中触发，使用 `setTimeout` 延迟执行
- 跳转同步：在 `jumpToNextTabStop()` 中触发，直接执行
- 两种模式使用相同的 `syncReferenceStops()` 方法，只是触发时机不同

### 调试模式

实时同步功能支持调试日志输出，通过 `setDebugRealtimeSync()` 函数控制：

```typescript
// src/snippetSession.ts:35-39
setDebugRealtimeSync(enabled: boolean): void
```

**使用方式**：
- 在插件初始化时，根据 `settings.enableDebugLogs` 设置调试模式
- 调试日志会输出到浏览器控制台，前缀为 `[ReferenceRealtime]`
- 日志内容包括：同步触发条件、跳过原因、执行状态等

**配置位置**：`main.ts:applyRuntimeSettings()` 中根据 `settings.enableDebugLogs` 自动设置

---

## 总结

实时同步更新机制是 ObVsnip 插件中处理引用 TabStop 的核心功能。它通过以下方式实现：

1. **监听机制**：使用 CodeMirror ViewPlugin 监听文档变化
2. **回调模式**：通过回调函数解耦检测和同步逻辑
3. **原子更新**：使用 CodeMirror Transaction 确保更新的原子性
4. **位置管理**：自动计算和更新所有 TabStop 的位置信息
5. **循环防护**：通过事务标记防止无限循环

该机制支持两种同步模式，用户可以根据需求选择实时同步或跳转同步，在用户体验和性能之间取得平衡。

