# Snippet Jump State Machine

## 状态

- **Idle**：默认状态，未进入 snippet 模式时的初始值，不携带额外数据。
- **AwaitingNextJump**：snippet 处于活跃状态、等待下一次 Tab/Shift-Tab 操作。必须包含当前 `currentIndex`、全部 `stops` 和可选的 `nextCandidate` 供下一次跳转使用。
- **MovingToStop**：在收到跳转命令后进入，记录 `targetIndex` 和 `targetStop`，表示正在执行 `focusStopByOffset` 移动。
- **EvaluatingExit**：光标移动完成后进入，用来判断是否已经抵达 `$0`、是否覆盖了隐式/零长度的 stop，或是否无候选而必须退出。
- **Exited**：snippet 模式终止，表示需要清空 session 堆栈并停止进一步跳转，可能伴随通知或日志。

## 事件

- **Expand**：snippet 展开事件，从 `Idle` 迁移到 `AwaitingNextJump`，初始化 `currentIndex` 并把第一个 stop 视为当前焦点。
- **JumpCommand**：Tab/Shift-Tab 等跳转命令，在 `AwaitingNextJump` 时触发，转入 `MovingToStop` 并提前决定下一跳的 `targetIndex`。
- **FocusComplete**：`focusStopByOffset` 完成后触发，进入 `EvaluatingExit`；此时可读取最新的选区/stop 信息用于判断是否退出。
- **ExitDecision**：在 `EvaluatingExit` 阶段做出的决策，要么继续回到 `AwaitingNextJump` 并更新 `currentIndex`/`nextCandidate`，要么进入 `Exited`。

## 上下文数据

- `currentIndex`：当前光标所在的 tab stop index。
- `nextCandidate`：基于当前状态计算出的下一次跳转的占位符（index + 具体 stop 信息）。
- `exitReason`：说明为何要退出 snippet 模式，例如 “已到 `$0`”、“隐式 `$0` 已覆盖” 或 “候选为空”。
- `stops`：当前 snippet session 中所有 tab stop 的绝对位置列表，用于在各个状态中定位。

## 状态转移规则

1. `Idle` + `Expand` → `AwaitingNextJump`（初始化 `currentIndex` 和 `nextCandidate`）。
2. `AwaitingNextJump` + `JumpCommand` → `MovingToStop`（确定 `targetIndex`/`targetStop`）。
3. `MovingToStop` + `FocusComplete` → `EvaluatingExit`（检查是否已到 `$0` 或候选无效）。
4. `EvaluatingExit` + `ExitDecision(continue)` → `AwaitingNextJump`（更新 `currentIndex`、重新计算 `nextCandidate`）。
5. `EvaluatingExit` + `ExitDecision(finish)` → `Exited`（调用 `exitSnippetMode`，可能递归进入新的 `AwaitingNextJump` 用于嵌套 session）。

此状态机清晰地将“先移动再判断”的流程建模出来，便于未来用联合类型或状态表实现并减少複杂的条件分支。需要时也可在日志中把状态切换记录下来，便于诊断 snippet 模式行为。
