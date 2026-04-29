# 两个 skill 的输出文件分析

## yiyue31-talk 输出文件

| 文件 | 说明 | 是否必需 |
|------|------|---------|
| `{title}/talk/state-{title}.json` | 状态文件（可恢复） | 辅助 |
| `{title}/talk/raw-{title}.md` | 原始文档 | 辅助 |
| `{title}/talk/analysis-raw-{title}.md` | 分析结果（实体、术语、金句） | **有价值** |
| `{title}/talk/entities-{title}.md` | 实体关系图（可选） | 可选 |
| `{title}/talk/qa-{title}.md` | 讨论记录 | **有价值** |
| `{title}/talk/viewpoint-mapping-{title}.md` | 观点映射表 | **有价值** |
| `{title}/talk/user-viewpoints-{title}.md` | **最终用户观点文档** | **必需** |
| `{title}/talk/review-*.md` | 各步骤审查报告 | 辅助 |

## yiyue31-summary 输出文件

| 文件 | 说明 | 是否必需 |
|------|------|---------|
| `{title}/summary/original-{title}.md` | 原始文章 | 辅助 |
| `{title}/summary/analysis-{title}.md` | 分析结果（结构、术语、金句） | **有价值** |
| `{title}/summary/analysis-gan-{title}.md` | 对抗审查 | 辅助 |
| `{title}/summary/summary-{title}.md` | 总结（未润色） | 辅助 |
| `{title}/summary/validation-{title}.md` | 质量检查 | 辅助 |
| `{title}/summary/final-summary-{title}.md` | **最终润色总结** | **必需** |
| `{title}/summary/refine-gan-{title}.md` | 润色结果检查 | 辅助 |

---

## 识别方法

### 方法1：通过目录结构识别
```
IF 存在目录 `{title}/talk/`:
    talk skill 已执行
IF 存在目录 `{title}/summary/`:
    summary skill 已执行
```

### 方法2：通过最终文件识别
```
IF 存在 `{title}/talk/user-viewpoints-{title}.md`:
    talk skill 已完成
IF 存在 `{title}/summary/final-summary-{title}.md`:
    summary skill 已完成
```

### 方法3：通过状态文件识别（talk 专用）
```
IF 存在 `{title}/talk/state-{title}.json`:
    读取状态，检查 `status` 是否为 "completed"
```

**推荐**：方法1（目录结构）最简单可靠

---

## 辅助文件的价值分析

### analysis-raw-{title}.md（talk）
**内容**：核心主题、文章结构、实体名词、术语分析、金句提取、不可改写内容
**价值**：
- 术语表可用于博客版的专业术语展示
- 金句提取可用于引用亮点
- 实体关系可用于个人回顾版的深度理解

### qa-{title}.md（talk）
**内容**：交互式讨论记录（话题、AI引导、用户回复、AI总结）
**价值**：
- **个人回顾版必需**：记录完整的思考过程
- **博客版可选**：可精简或省略

### viewpoint-mapping-{title}.md（talk）
**内容**：观点映射表（观点ID、摘要、对应原文段落、目标章节）
**价值**：
- 确保所有用户观点都被包含
- 可用于生成"原文观点 vs 我的理解"对比

### analysis-{title}.md（summary）
**内容**：语言分析、文章类型、主题分析、结构分析、术语分析、金句提取
**价值**：
- 与 talk 的分析结果互补
- 可用于术语统一和金句合并

---

## 合并时的辅助文件使用建议

| 辅助文件 | 博客版 | 个人回顾版 |
|---------|-------|----------|
| analysis-raw-{title}.md | 术语表、金句 | 完整保留 |
| qa-{title}.md | 精简或省略 | **完整保留** |
| viewpoint-mapping-{title}.md | 内部使用（确保完整） | 可展示 |
| analysis-{title}.md | 内部使用 | 可参考 |
| original-{title}.md | 不使用 | 可链接 |

---

## 结论

**必需输入文件：**
1. `{title}/talk/user-viewpoints-{title}.md`
2. `{title}/summary/final-summary-{title}.md`

**推荐辅助文件：**
1. `{title}/talk/qa-{title}.md` - 个人回顾版需要
2. `{title}/talk/analysis-raw-{title}.md` - 术语和金句
3. `{title}/talk/viewpoint-mapping-{title}.md` - 确保完整性

**识别方法**：检查目录 `{title}/talk/` 和 `{title}/summary/` 是否存在
