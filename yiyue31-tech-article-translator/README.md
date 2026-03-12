# yiyue31-tech-article-translator

专业的英文技术文章翻译工具，翻译为中文的同时保留技术术语和准确性。

## 功能亮点

- **智能主题识别**：自动提取标题、关键概念，确定技术领域
- **自定义术语表系统**：每个主题维护独立的技术术语表
- **术语保留机制**：术语表中的词汇保持英文不翻译
- **双语翻译模式**：支持直译（逐字翻译）和意译（适应中文习惯）
- **主动术语维护**：翻译前提取新术语，用户确认后更新术语表
- **质量双重校验**：翻译质量检查 + Markdown 格式验证
- **多输入源支持**：URL、文件路径、直接粘贴内容

## 快速开始

### 基本用法

```
翻译这篇文章：https://example.com/react-hooks
```

### 文件输入

```
翻译 ./articles/python-async.md
```

### 直接粘贴内容

```
[粘贴英文技术文章内容]
```

### 指定翻译风格

```
翻译 https://example.com/react-hooks，使用意译风格
```

## 工作流程

```
┌─────────────────┐
│ 1. 获取文章内容   │ ← URL / 文件 / 粘贴
└────────┬────────┘
         ▼
┌─────────────────┐
│ 2. 分析主题      │ ← 提取关键词、加载术语表
└────────┬────────┘
         ▼
┌─────────────────┐
│ 3. 询问翻译风格  │ ← 直译(默认) / 意译
└────────┬────────┘
         ▼
┌─────────────────┐
│ 4. 术语表维护    │ ← 提取新术语、用户确认
└────────┬────────┘
         ▼
┌─────────────────┐
│ 5. 翻译文章      │ ← 保留术语、维护格式
└────────┬────────┘
         ▼
┌─────────────────┐
│ 6. 质量校验      │ ← 翻译质量 + Markdown格式
└─────────────────┘
```

## 目录结构

```
yiyue31-tech-article-translator/
├── SKILL.md                 # 主技能定义和工作流程
├── CLAUDE.md               # 文档生成规则
├── README.md               # 本文件
├── .gitignore              # 忽略生成的内容
├── glossary/               # 技术术语表
│   ├── template.md         # 术语表模板
│   ├── react.md           # React 相关术语
│   ├── python.md          # Python 相关术语
│   └── kubernetes.md      # Kubernetes 相关术语
└── articles/               # 输出目录（gitignored）
    └── 2026-03/           # 按年月组织
        └── react-hooks-deep-dive.md
```

## 术语表系统

### 术语表文件格式

文件位置：`glossary/{topic}.md`

```markdown
# Topic: React

| English Term | Chinese Explanation |
|--------------|-------------------|
| useState | 状态钩子 |
| useEffect | 副作用钩子 |
| Virtual DOM | 虚拟DOM |
```

### 工作原理

1. **翻译前**：为识别的主题加载术语表
2. **术语提取**：扫描文章，识别不在术语表中的专业术语
3. **用户确认**：展示新术语列表，用户选择全部添加、部分添加或跳过
4. **更新术语表**：确认的术语追加到 `glossary/{topic}.md`
5. **翻译时**：术语表中的词汇保持英文（不翻译）
6. **Git 提交**：如果存在 git 仓库，自动提交：
   ```
   docs: update glossary for {topic} ({YYYY-MM-DD})
   ```

## 翻译规则

### 保留内容

- 代码块（```language...```）及语言标识符
- 行内代码（`...`）
- URL 和链接
- 命令行指令
- 术语表中的技术术语
- 图片引用（需验证语言匹配）
- YAML 前置内容（按规则转换）

### 翻译风格对比

| 风格 | 说明 | 适用场景 |
|------|------|----------|
| **直译 (Literal)** | 逐字翻译，保留原文结构 | 技术文档、API 文档 |
| **意译 (Free)** | 适应中文习惯，重组语句 | 技术博客、教程 |

### 术语处理示例

- **首次出现**：`useState (状态钩子)`
- **后续出现**：`useState`
- **不在术语表**：翻译为中文

### 译者注释规则

针对因术语、文化差异、领域知识难以理解的内容：

- **格式**：`译文（English original，通俗解释）`
- **位置**：在需要解释的内容后立即添加
- **深度适配**：
  - 普通读者：注释更详细
  - 专业读者：可简化
- **使用原则**：仅在必要时注释，避免过度标注浅显词汇

### YAML 前置内容处理

原文包含 YAML 前置内容时：

1. **重命名字段**：添加 `source` 前缀
   - `url` → `sourceUrl`
   - `title` → `sourceTitle`
   - `description` → `sourceDescription`
   - `author` → `sourceAuthor`
   - `date` → `sourceDate`

2. **翻译字段**：创建新的顶层字段
   - 翻译标题、描述等文本字段
   - 保留原文作为 `source_*` 字段

3. **保留字段**：标签、分类、自定义字段保持原样

### 意译额外规则

- **重意不重形**：翻译核心表意，而非逐字直译
- **情感保真**：保留措辞的情感内涵
- **表达流畅**：采用地道的中文语序和句式

## 输出格式

### 文件保存位置

```
articles/{YYYY-MM}/{article-name}.md
```

**文件命名规则**：使用翻译后的标题，小写字母，单词间用连字符连接

### YAML 前置内容

```yaml
---
title: React Hooks 深度解析
source_title: Deep Dive into React Hooks
source_url: https://example.com/react-hooks
source_author: John Doe
translated_at: 2024-02-24
translation_style: literal
topic: react
language: en → zh
---
```

## Markdown 格式校验清单

### 翻译质量检查

- [ ] **术语一致性**：术语表中的词汇保持英文，首次出现添加中文注释
- [ ] **格式保留**：代码块、行内代码、URL、命令行等格式正确保留
- [ ] **语言流畅度**：翻译后的文本符合中文表达习惯
- [ ] **无遗漏**：检查是否有段落、句子或技术细节被遗漏

### Markdown 格式检查

- [ ] **标题层级**：# → ## → ### 顺序，不跳跃
- [ ] **列表缩进**：同层级缩进一致（2空格），分隔符统一
- [ ] **代码块**：``` 后加语言标识，保留原文缩进
- [ ] **数学公式**：行内用 $，独立用 $$
- [ ] **表格格式**：| 对齐正确，表头分隔符 ≥3个-
- [ ] **Mermaid 图表**：```mermaid 开头，语法正确
- [ ] **换行规则**：段落间空一行，列表项间无空行
- [ ] **空行控制**：连续不超过2行
- [ ] **链接格式**：[文本](URL) 格式正确
- [ ] **特殊字符**：| < > 需转义处已处理
- [ ] **行尾空格**：无多余空格
- [ ] **中英文空格**：之间保留一个空格

## 支持的主题

当前可用术语表：

- **React**：Hooks、Components、Virtual DOM 等
- **Python**：Decorators、Generators、Async/Await 等
- **Kubernetes**：Pods、Deployments、Services 等
- **AI/ML**：Neural Networks、Transformers、LLM 等

添加新主题：

1. 创建 `glossary/{topic}.md`（参考 `glossary/template.md`）
2. 按表格格式添加技术术语
3. 提交到 git 仓库

### 术语表命名规则

- 使用小写：`ai.md`、`react.md`、`python.md`
- 子主题：`react-hooks.md`、`kubernetes-deployment.md`
- 多单词主题用连字符：`machine-learning.md`

## 错误处理

### 文件获取失败
- **URL 无法访问**：提示用户检查 URL 或直接粘贴内容
- **文件不存在**：提示用户确认路径

### 主题未识别
- **自动识别失败**：询问用户指定主题
- **多个可能主题**：询问用户选择

### 术语表缺失
- **自动创建**：创建新的术语表文件
- **提示用户**：建议添加初始术语

### 语言识别
- **主要内容是中文**（超过50%）：请用户确认是否继续
- **其他非英文语言**：请用户确认是否继续

## 系统要求

- **编码**：UTF-8（支持中文字符）
- **Git 仓库**：可选（用于自动提交功能）
- **Claude Code**：兼容 Claude Code CLI

## 开发指南

### 添加新术语表

1. 复制 `glossary/template.md` 为 `glossary/{topic}.md`
2. 填写主题名称和技术术语
3. 提交到 git 仓库

### 长文章处理

超长文章将分章节翻译，逐步输出结果，避免上下文溢出。

## 相关技能

- [yiyue31-courseware-generator](../yiyue31-courseware-generator/) - 生成初中理科自学课件
- [yiyue31-summary-generator](../yiyue31-summary-generator/) - 生成技术文章结构化摘要

---

**Version**: 1.0.0
**Skill ID**: `yiyue31-tech-article-translator`
**Category**: Content Creation
**Author**: Yiyue31
**Tags**: #translation #tech #chinese #terminology
