# Skills 命名审查

## 当前所有 Skills

| 目录名 | SKILL.md 中的 name | 功能 | 一致性 | 问题 |
|--------|------------------|------|--------|------|
| `yiyue31-summary` | `yiyue31-summary` | 文章总结 | ✅ | 无 |
| `yiyue31-talk` | `yiyue31-talk` | 对话观点 | ✅ | 无 |
| `yiyue31-notes` | `yiyue31-notes` | 学习笔记 | ✅ | 无 |
| `yiyue31-courseware-generator` | `yiyue31-science-courseware-generator` | 生成理科课件 | ❌ | 名称不一致 |
| `yiyue31-journal-article-formatter` | `chinese-journal-formatter` | 格式化论文 | ❌ | 名称不一致 |
| `yiyue31-tech-article-translator` | `yiyue31-tech-article-translator` | 翻译技术文章 | ✅ | 名称过长 |

---

## 问题分析

### 1. yiyue31-courseware-generator

**问题**：
- 目录名：`yiyue31-courseware-generator`
- SKILL.md name：`yiyue31-science-courseware-generator`
- 不一致！

**功能**：初中理科（物理/化学/生物）自学课件生成

**命名建议**：
| 选项 | 名称 | 理由 | 字符数 |
|------|------|------|--------|
| A | `yiyue31-science` | 强调科学属性 | 18 |
| B | `yiyue31-lab` | 强调实验性质 | 15 |
| C | `yiyue31-science-courseware` | 保留 courseware，更直观 | 27 |
| D | `yiyue31-courseware` | 简洁，但较泛 | 21 |
| E | `yiyue31-slides` | 强调幻灯片形式 | 17 |

### 2. yiyue31-journal-article-formatter

**问题**：
- 目录名：`yiyue31-journal-article-formatter`
- SKILL.md name：`chinese-journal-formatter`
- 不一致！前缀也不统一

**功能**：中文学术论文格式化为期刊投稿格式，**重点是两栏排版**

**用户触发词**："格式化论文"、"转期刊格式"、"排版论文"、"双栏排版"

**命名建议**：
| 选项 | 名称 | 理由 | 字符数 |
|------|------|------|--------|
| A | `yiyue31-journal` | 强调期刊格式 | 19 |
| B | `yiyue31-columns` | 强调两栏排版 | 18 |
| C | `yiyue31-layout` | 强调整体排版 | 17 |
| D | `yiyue31-paper-layout` | 论文排版，直观 | 20 |
| E | `yiyue31-column-layout` | 两栏排版，最精准 | 21 |

### 3. yiyue31-tech-article-translator

**问题**：
- 名称太长（带前缀 27 字符）
- `tech-article` 是冗余描述

**功能**：翻译技术文章

**命名建议**：
| 选项 | 名称 | 理由 |
|------|------|------|
| A | `yiyue31-translate` | 最简洁 |
| B | `yiyue31-translator` | 强调工具 |
| C | `yiyue31-translation` | 强调过程 |

---

## 推荐方案

### 方案A：保留关键词（平衡简洁和直观）

| 当前 | 建议 | 功能 | 理由 |
|------|------|------|------|
| `yiyue31-courseware-generator` | `yiyue31-science-courseware` | 科学课件 | 保留 courseware，强调科学 |
| `yiyue31-journal-article-formatter` | `yiyue31-paper-format` | 论文格式化 | 保留 format，强调论文 |
| `yiyue31-tech-article-translator` | `yiyue31-translate` | 翻译文章 | 最简洁 |

### 方案B：名词导向（更直观）

| 当前 | 建议 | 功能 | 理由 |
|------|------|------|------|
| `yiyue31-courseware-generator` | `yiyue31-science` | 科学课件 | 直接表明是科学类 |
| `yiyue31-journal-article-formatter` | `yiyue31-paper` | 论文格式化 | 直接表明是论文 |
| `yiyue31-tech-article-translator` | `yiyue31-translator` | 翻译器 | 工具导向 |

### 方案C：动作导向（与 summary/talk 对称）

| 当前 | 建议 | 功能 | 理由 |
|------|------|------|------|
| `yiyue31-courseware-generator` | `yiyue31-generate` | 生成课件 | 极简动作 |
| `yiyue31-journal-article-formatter` | `yiyue31-format` | 格式化论文 | 极简动作 |
| `yiyue31-tech-article-translator` | `yiyue31-translate` | 翻译文章 | 极简动作 |

| 当前 | 建议 | 功能 |
|------|------|------|
| `yiyue31-courseware-generator` | `yiyue31-science` | 理科课件 |
| `yiyue31-journal-article-formatter` | `yiyue31-journal` | 期刊格式 |
| `yiyue31-tech-article-translator` | `yiyue31-translator` | 翻译工具 |

---

## 一致性问题

### 命名风格不统一

当前 skills 混合了多种命名风格：
1. **动作导向**：`summary`, `talk`, `translate`
2. **结果导向**：`notes`, `courseware`
3. **描述型**：`journal-article-formatter`, `tech-article-translator`

### 前缀不一致

- 大部分：`yiyue31-`
- 特例：`chinese-journal-formatter`

### 目录名与 SKILL.md name 不一致

| 目录 | SKILL.md name |
|------|---------------|
| `yiyue31-courseware-generator` | `yiyue31-science-courseware-generator` |
| `yiyue31-journal-article-formatter` | `chinese-journal-formatter` |

---

## 后续步骤

- [ ] 确认命名方案
- [ ] 修复名称不一致问题
- [ ] 重命名目录
- [ ] 更新 SKILL.md
- [ ] 测试验证

---

## 待确认

- [ ] 是否采用方案A（极简对称）？
- [ ] 是否有其他命名考虑？
