---
name: yiyue31-notes
description: Merge outputs from yiyue31-summary (article summary) and yiyue31-talk (user viewpoints) into unified learning notes. Use when user has completed both prerequisite skills and requests merging, or asks to "merge notes", "combine summary and viewpoints".
disable-model-invocation: true
version: 1.0.0
author: Yiyue31
---

# 学习笔记合并

合并文章总结（summary）和用户观点（talk）为统一学习笔记。

---

## 工作流程

### Step 0：检查前置文件

**必需文件**:
- `{title}/summary/final-summary-{title}.md`
- `{title}/talk/user-viewpoints-{title}.md`

**检查逻辑**: 若缺失，询问用户提供替代路径；无效则终止任务。

### Step 1：识别标题

从 `final-summary-{title}.md` 或目录名称提取标题。

### Step 2：选择合并方式

使用 AskUserQuestion 询问:

| 选项 | 描述 |
|------|------|
| **Talk前置** | 观点内容放在文章概述后 |
| **Talk后置** | 观点内容作为独立章节（文档末尾） |
| **Talk交替** | 观点内容放在对应总结章节后 |

### Step 3：读取输入文件

读取 `final-summary` 和 `user-viewpoints`。

### Step 4：生成合并文档

**合并原则**: 不修改输入原文内容，可以增加承上启下的过渡文字

**输出路径**: `{title}/notes/notes-{title}.md`


#### Talk前置

```markdown
# [标题] 学习笔记

## 文章信息
- 原文、来源、阅读时间

## 文章概述
[summary 核心亮点/概述部分]

## 我的观点
[user-viewpoints 完整内容]

## 核心内容
[summary 章节总结部分]

## 收获与启发
[合并双方]
```

#### Talk后置

```markdown
# [标题] 学习笔记

## 文章信息
- 原文、来源、阅读时间

## 文章总结
[final-summary 完整内容]

## 我的观点
[user-viewpoints 完整内容]

## 收获与启发
[合并双方]
```

#### Talk交替

```markdown
# [标题] 学习笔记

## 文章信息
- 原文、来源、阅读时间

## 核心内容
[summary 章节 1]

### 我的观点
[talk 对应观点 1]

[summary 章节 2]

### 我的观点
[talk 对应观点 2]

## 收获与启发
[合并双方]
```

### Step 5：质量校验

必须使用 subagent 检查生成的合并文档：

**检查项**：
- **合并规则**: 是否遵守了选择的合并方式（前置/后置/交替）
- **内容完整**: 是否包含 summary 和 talk 的所有关键内容
- **原文保护**: 禁止修改或删减输入原文内容
- **可读性**: 结构是否清晰，过渡是否自然
- 校验失败必须重新生成

**输出位置**: `{title}/notes/validation-report-{title}.md`

---

## 注意事项

- 不调用其他技能，只读取现有输出
