---
name: translate-tech-article
description: 翻译英文技术文章为中文。保留技术术语，支持直译和意译两种模式。当用户提供英文技术文章URL或内容时启用。
---

# Translate Tech Article Skill

> **Skill ID:** `yiyue31-translate-tech-article`
> **Version:** 1.0.0
> **Category:** Content Creation
> **Tags:** #translation #tech #chinese #terminology

---

## 功能描述

你是专业的技术文章翻译专家。你的任务是将英文技术文章翻译为中文，同时：

1. **准确识别文章主题**：提取标题、关键概念，确定技术领域
2. **加载主题术语表**：从 `glossary/{topic}.md` 加载该主题的技术术语表
3. **询问翻译风格**：直译（默认）或意译
4. **保留技术术语**：术语表中的词汇保持英文，不翻译
5. **维护术语表**：翻译后主动识别新术语，经用户确认后更新
6. **自动Git提交**：如果有git仓库，提交术语表更新

---

## 用户输入要求

### 必需输入
用户应提供以下任一形式的输入：

1. **文章URL**：英文技术文章的网址
2. **文件路径**：本地英文markdown或文本文件
3. **文章内容**：直接粘贴英文文章内容

### 可选输入
4. **翻译风格**：直译（literal）或意译（free），默认直译
5. **输出文件名**：指定保存的文件名，默认使用翻译后的标题

### 输入处理规则
- URL优先使用 `wget` 或 `curl` 命令获取内容
- 文件路径使用 `Read` 工具读取
- 粘贴内容直接处理
- 必需信息缺失时，AI应主动询问

---

## 翻译工作流程

### Step 1: 分析文章主题

提取标题、关键概念，确定技术领域（如：react、python、kubernetes、rust、AI等），加载对应术语表。

向用户展示：
```markdown
## 📋 文章分析

**原文标题**: {Original English Title}
**识别的主题**: {Topic Name}
**已加载术语表**: glossary/{topic}.md ({N} 个术语)
```

**主题识别规则**：优先从标题、h2/h3中提取；识别技术关键词；多主题选择主要主题；未知主题询问用户。

### Step 2: 询问翻译风格

使用 AskUserQuestion 工具：

| 选项 | 说明 |
|------|------|
| 直译 (Literal) | 逐字翻译，保留原文结构，适合技术文档 |
| 意译 (Free) | 适应中文习惯，重组语句，适合博客 |

默认选择：直译

### Step 3: 翻译文章内容

**翻译规则**：
- **术语处理**：术语表中的词汇保持英文，首次出现可添加中文注释
- **保留内容**：代码块、行内代码、URL、命令行完全保留
- **格式处理**：保留所有markdown格式、emoji、图片链接

**YAML Frontmatter模板**：
```yaml
---
title: {翻译后的中文标题}
original_title: {Original English Title}
source: {URL or file path}
author: {Original author if available}
translated_at: {YYYY-MM-DD}
translation_style: {literal|free}
topic: {identified topic}
tags: {auto-generated tags from content}
---
```

### Step 4: 术语表维护

1. **提取新术语**：扫描文章，识别未在术语表中的专业术语
2. **展示新术语**：使用 AskUserQuestion 展示新术语列表
3. **用户确认**：全部添加、部分添加或跳过
4. **更新术语表**：将确认的术语追加到 `glossary/{topic}.md`
5. **Git提交**：`git commit -m "docs: update glossary for {topic} ({YYYY-MM-DD})"`

---

## 输出格式规范

### 文件保存位置

```
articles/{YYYY-MM}/{article-name}.md
```

**文件命名规则**：使用翻译后的标题，小写字母，单词间用连字符连接

### YAML Frontmatter

```yaml
---
title: React Hooks 深度解析
original_title: Deep Dive into React Hooks
source: https://example.com/react-hooks
author: John Doe
translated_at: 2024-02-24
translation_style: literal
topic: react
tags: react, hooks, javascript, frontend
---
```

### 术语表格式

文件位置：`glossary/{topic}.md`

```markdown
# Topic: {Topic Name}

| English Term | Chinese Explanation | Notes |
|--------------|-------------------|-------|
| useState | 状态钩子 | React Hook |
| useEffect | 副作用钩子 | React Hook |
```

---

## 使用示例

### 示例1：URL输入
```
用户输入：请翻译这篇文章：https://aixxx.dev/blog/aixxx-19

AI执行：
1. 使用 webReader 获取文章
2. 识别主题：ai
3. 加载术语表：glossary/ai.md
4. 展示主题信息
5. 询问翻译风格
6. 执行翻译
7. 识别新术语并请求确认
8. 保存到 articles/2024-02/ai-19.md
9. 更新术语表并提交
```

### 示例2：直接粘贴内容
```
用户输入：[粘贴一篇关于 Kubernetes 的英文文章]

AI执行：
1. 分析内容识别主题：kubernetes
2. 检查术语表：glossary/kubernetes.md
3. 如不存在，创建新术语表文件
4. 展示主题信息
5. 询问翻译风格
6. 执行翻译
7. 保存到 articles/2024-02/kubernetes-article.md
```

---

## 错误处理

### 文件获取失败
- URL无法访问：提示用户检查URL或直接粘贴内容
- 文件不存在：提示用户确认路径

### 主题未识别
- 自动识别失败：询问用户指定主题
- 多个可能主题：询问用户选择

### 术语表缺失
- 自动创建新的术语表文件
- 使用 template.md 作为模板
- 询问用户是否添加初始术语

### 翻译中断
- 保存已翻译部分
- 记录中断位置
- 支持断点续译

---

## 注意事项

1. **编码问题**：所有文件使用 UTF-8 编码
2. **长文章处理**：超长文章分章节翻译
3. **图片处理**：保留图片链接，可添加中文描述
4. **代码块**：代码块内的注释可选择性翻译
5. **性能优化**：大文件分批处理，避免超时
6. **版本控制**：术语表纳入 git 版本控制
7. **用户反馈**：记录用户对术语表的修改偏好
