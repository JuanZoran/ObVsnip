# ObVsnip Snippet 功能示例

本文档展示了 ObVsnip 支持的所有 snippet 功能，每个示例都可以直接复制到你的 snippet 文件中进行测试。

## 目录

1. [基本占位符](#基本占位符)
2. [默认值占位符](#默认值占位符)
3. [选择列表](#选择列表)
4. [变量](#变量)
5. [引用 Snippet（多位置同步）](#引用-snippet多位置同步)
6. [嵌套占位符](#嵌套占位符)
7. [转义字符](#转义字符)
8. [多行 Body](#多行-body)
9. [隐藏片段](#隐藏片段)
10. [优先级设置](#优先级设置)
11. [完整示例集合](#完整示例集合)

---

## 基本占位符

使用 `$1`, `$2`, `$3` 等创建可跳转的占位符。按 `Tab` 键在占位符之间跳转。

### 示例 1: 简单占位符

```json
{
  "simple-placeholder": {
    "prefix": "ph",
    "body": "Hello $1, welcome to $2!",
    "description": "简单的占位符示例"
  }
}
```

**使用方法**: 输入 `ph` 然后按 `Tab`，会插入 `Hello |, welcome to |!`（`|` 表示光标位置）

---

## 默认值占位符

使用 `${1:default}` 格式为占位符提供默认值。默认值会被自动插入，可以直接编辑或删除。

### 示例 2: 带默认值的占位符

```json
{
  "default-value": {
    "prefix": "def",
    "body": "function ${1:myFunction}(${2:param}) { return ${3:value}; }",
    "description": "带默认值的函数模板"
  }
}
```

**使用方法**: 输入 `def` 然后按 `Tab`，会插入 `function myFunction|(param|) { return value|; }`

---

## 选择列表

使用 `${1|option1,option2,option3|}` 格式创建可循环的选择列表。按 `Ctrl+Space` 循环选择。

### 示例 3: 选择列表

```json
{
  "choice-list": {
    "prefix": "choice",
    "body": "const type: ${1|string,number,boolean|} = ${2:value};",
    "description": "TypeScript 类型选择"
  }
}
```

**使用方法**: 
- 输入 `choice` 然后按 `Tab`
- 在第一个占位符处按 `Ctrl+Space` 循环选择类型
- 按 `Tab` 跳转到下一个占位符

### 示例 4: 多个选择列表

```json
{
  "multiple-choices": {
    "prefix": "mchoice",
    "body": "export ${1|const,let,var|} ${2:name} = ${3|true,false,0,\"\"|};",
    "description": "多个选择列表"
  }
}
```

---

## 变量

ObVsnip 支持以下内置变量：

- `TM_FILENAME` - 当前文件名（包含扩展名）
- `TM_FILEPATH` - 当前文件在仓库中的路径
- `TM_FOLDER` - 当前文件所在文件夹名称
- `VAULT_NAME` - 当前仓库名称
- `TM_SELECTED_TEXT` - 编辑器中当前选中的文本
- `TM_CLIPBOARD` - 当前剪贴板文本（仅桌面版）
- `CURRENT_YEAR` - 当前年份（YYYY）
- `CURRENT_MONTH` - 当前月份（MM）
- `CURRENT_DATE` - 当前日期（YYYY-MM-DD）
- `CURRENT_HOUR` - 当前小时（HH，24 小时制）
- `CURRENT_MINUTE` - 当前分钟（MM）
- `CURRENT_SECOND` - 当前秒钟（SS）
- `TIME_FORMATTED` - 当前时间（HH:mm:ss）

### 示例 5: 使用变量

```json
{
  "variables": {
    "prefix": "var",
    "body": [
      "File: ${TM_FILENAME}",
      "Path: ${TM_FILEPATH}",
      "Folder: ${TM_FOLDER}",
      "Vault: ${VAULT_NAME}",
      "Date: ${CURRENT_DATE}",
      "Time: ${TIME_FORMATTED}"
    ],
    "description": "显示文件信息和日期时间"
  }
}
```

### 示例 6: 变量带默认值

```json
{
  "variable-default": {
    "prefix": "vardef",
    "body": "Author: ${TM_FILENAME:Unknown} | Year: ${CURRENT_YEAR:2024}",
    "description": "变量带默认值（如果变量无法解析）"
  }
}
```

---

## 引用 Snippet（多位置同步）

**新功能！** 当同一个占位符索引（如 `$1`）在多个位置出现时，它们会自动同步。编辑其中一个位置，其他位置会同步更新。

### 示例 7: 引用 Snippet - 函数参数同步

```json
{
  "reference-function": {
    "prefix": "ref",
    "body": "function $1($1) { return $1; }",
    "description": "函数名在三个位置同步"
  }
}
```

**使用方法**: 
- 输入 `ref` 然后按 `Tab`
- 在第一个 `$1` 处输入函数名，例如 `add`
- 其他两个位置的 `$1` 会自动同步为 `add`
- 结果: `function add(add) { return add; }`

### 示例 8: 引用 Snippet - 变量声明同步

```json
{
  "reference-var": {
    "prefix": "refvar",
    "body": "const $1 = ${2:value}; const $1 = ${2:value};",
    "description": "变量名和值在多处同步"
  }
}
```

**同步模式设置**:
- **实时同步** (`realtime`): 编辑时立即同步（默认）
- **跳转同步** (`on-jump`): 跳转到下一个占位符时同步

在设置页面的 "Reference Snippet" 部分可以配置同步模式。

### 示例 9: 引用 Snippet 与选择列表结合

```json
{
  "reference-choice": {
    "prefix": "refchoice",
    "body": "type $1 = ${1|string,number,boolean|}; const x: $1;",
    "description": "类型定义在多处同步，且支持选择"
  }
}
```

---

## 嵌套占位符

占位符可以嵌套，内层占位符会在外层占位符之后访问。

### 示例 10: 嵌套占位符

```json
{
  "nested": {
    "prefix": "nest",
    "body": "function ${1:outer ${2:inner}}() {}",
    "description": "嵌套占位符示例"
  }
}
```

**跳转顺序**: 先访问 `$2`（inner），然后 `$1`（outer），最后 `$0`

---

## 转义字符

使用 `$$` 表示字面量 `$`，使用 `\\` 表示字面量 `\`。

### 示例 11: 转义字符

```json
{
  "escape": {
    "prefix": "esc",
    "body": "Price: $$100, Path: \\\\server\\\\share",
    "description": "转义字符示例"
  }
}
```

**结果**: `Price: $100, Path: \\server\\share`

---

## 多行 Body

使用数组格式创建多行 snippet。

### 示例 12: 多行代码块

```json
{
  "multiline": {
    "prefix": "ml",
    "body": [
      "function ${1:name}(${2:params}) {",
      "  ${3:// code}",
      "  return ${4:value};",
      "}"
    ],
    "description": "多行函数模板"
  }
}
```

### 示例 13: Markdown 模板

```json
{
  "markdown-note": {
    "prefix": "note",
    "body": [
      "> [!note]",
      "> ${1:内容}",
      "",
      "创建时间: ${CURRENT_DATE} ${TIME_FORMATTED}",
      "文件: ${TM_FILENAME}"
    ],
    "description": "Markdown 备注模板"
  }
}
```

---

## 隐藏片段

使用 `hide: true` 隐藏片段，使其不出现在补全菜单中（但仍可通过前缀触发）。

### 示例 14: 隐藏片段

```json
{
  "hidden": {
    "prefix": "hide",
    "body": "This snippet is hidden from the menu",
    "description": "隐藏的片段",
    "hide": true
  }
}
```

---

## 优先级设置

使用 `priority` 字段调整片段在补全菜单中的排序（数字越大优先级越高）。

### 示例 15: 优先级设置

```json
{
  "high-priority": {
    "prefix": "hp",
    "body": "High priority snippet",
    "description": "高优先级片段",
    "priority": 100
  },
  "low-priority": {
    "prefix": "lp",
    "body": "Low priority snippet",
    "description": "低优先级片段",
    "priority": 1
  }
}
```

---

## 完整示例集合

以下是一个包含多种功能的完整 snippet 文件示例，可以直接复制使用：

```json
{
  "complete-example": {
    "prefix": "complete",
    "body": [
      "// File: ${TM_FILENAME}",
      "// Created: ${CURRENT_DATE} ${TIME_FORMATTED}",
      "",
      "export ${1|class,interface,type|} ${2:MyClass} {",
      "  ${3:property}: ${4|string,number,boolean|};",
      "",
      "  constructor(${5:params}) {",
      "    ${6:// initialization}",
      "  }",
      "",
      "  ${7:method}(): ${8:returnType} {",
      "    return ${9:value};",
      "  }",
      "}"
    ],
    "description": "完整的 TypeScript 类模板示例"
  },
  
  "reference-sync-example": {
    "prefix": "sync",
    "body": "const $1 = $2; const $1 = $2; const $1 = $2;",
    "description": "引用同步示例 - 变量名和值在三处同步"
  },
  
  "choice-with-default": {
    "prefix": "cdef",
    "body": "const ${1:name}: ${2|string,number|} = ${3:defaultValue};",
    "description": "选择列表与默认值结合"
  },
  
  "nested-complex": {
    "prefix": "ncomp",
    "body": "function ${1:outer ${2:middle ${3:inner}}}() {}",
    "description": "多层嵌套占位符"
  },
  
  "variable-template": {
    "prefix": "template",
    "body": [
      "---",
      "title: ${1:Title}",
      "date: ${CURRENT_DATE}",
      "author: ${VAULT_NAME}",
      "tags: ${2:tag1, tag2}",
      "---",
      "",
      "${3:Content}"
    ],
    "description": "使用变量的模板"
  }
}
```

---

## 使用技巧

1. **Tab 键跳转**: 在 snippet 模式下，按 `Tab` 跳转到下一个占位符，`Shift+Tab` 跳转到上一个
2. **循环选择**: 在包含选择列表的占位符处，按 `Ctrl+Space` 循环选择
3. **退出 Snippet 模式**: 到达 `$0` 或最后一个占位符后按 `Tab` 退出
4. **引用同步**: 
   - 实时模式：编辑时立即同步（适合快速输入）
   - 跳转模式：跳转时同步（适合需要确认的场景）
5. **变量解析**: 如果变量无法解析，可以使用默认值，例如 `${TM_FILENAME:Untitled}`

---

## 测试建议

1. 将上述 JSON 保存为 `snippets.json` 文件
2. 在 ObVsnip 设置中添加该文件
3. 重新加载片段（点击 "Reload snippets" 按钮）
4. 在 Obsidian 编辑器中输入各个 `prefix` 进行测试
5. 尝试不同的跳转和选择操作，体验各种功能

---

## 注意事项

- 所有占位符索引从 `$1` 开始，`$0` 是特殊的结束占位符（自动添加）
- 引用 snippet 功能需要在设置中启用（默认已启用）
- 变量解析失败时会使用默认值（如果提供）或空字符串
- 选择列表的第一个选项会作为初始值插入
- 隐藏的片段（`hide: true`）不会出现在补全菜单中，但仍可通过前缀触发

---

## 更多信息

- 查看 [架构文档](./architecture.md) 了解技术细节
- 查看 [TabStop 策略文档](./tabstop-strategy.md) 了解跳转策略
- 在设置页面查看所有内置变量的详细说明

