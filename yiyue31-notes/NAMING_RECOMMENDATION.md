# 三个 Skills 的命名方案

## 当前名称分析

| Skill | 当前名称 | 功能 | 问题 |
|-------|---------|------|------|
| 1 | `yiyue31-summary-generator` | 自动生成文章总结 | 过长，"generator" 冗余 |
| 2 | `yiyue31-takeaways` | 对话提取用户观点 | "takeaways" 太抽象，中文难理解 |
| 3 | `yiyue31-personal-insights` | 合并两份文档 | 与 takeaways 概念重叠 |

---

## 三个 Skills 的关系

```
┌─────────────────┐
│  用户阅读文章    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼────┐ ┌──▼─────────┐
│ Skill 1│ │ Skill 2    │
│客观分析│ │对话提取观点 │
└───┬────┘ └──┬─────────┘
    │         │
    │  summary│  viewpoints
    │         │
    └────┬────┘
         │
    ┌────▼─────────┐
    │ Skill 3      │
    │ 整合文档     │
    └──────────────┘
         │
      最终文档
```

**角色定位：**
- Skill 1：客观分析者（无人参与）
- Skill 2：主观表达者（人机对话）
- Skill 3：综合整理者（整合输出）

---

## 命名方案对比

### 方案A：动作导向（简洁清晰）

| 当前 | 新名称 | 含义 |
|------|--------|------|
| `yiyue31-summary-generator` | `yiyue31-summarize` | 总结文章 |
| `yiyue31-takeaways` | `yiyue31-discuss` | 讨论观点 |
| `yiyue31-personal-insights` | `yiyue31-integrate` | 整合文档 |

**优点**：动词语境，清晰易懂
**缺点**：不够具体，"discuss" 太泛

### 方案B：输出导向（直观明确）

| 当前 | 新名称 | 含义 |
|------|--------|------|
| `yiyue31-summary-generator` | `yiyue31-article-summary` | 文章总结 |
| `yiyue31-takeaways` | `yiyue31-my-views` | 我的观点 |
| `yiyue31-personal-insights` | `yiyue31-learning-notes` | 学习笔记 |

**优点**：直接告诉用户会得到什么
**缺点**：命名风格不统一（article-summary vs my-views）

### 方案C：学习流程（体现认知路径）

| 当前 | 新名称 | 含义 |
|------|--------|------|
| `yiyue31-summary-generator` | `yiyue31-understand` | 理解文章 |
| `yiyue31-takeaways` | `yiyue31-express` | 表达观点 |
| `yiyue31-personal-insights` | `yiyue31-consolidate` | 巩固成笔记 |

**优点**：体现学习递进关系
**缺点**：抽象，不够直观

### 方案D：中文拼音（针对中文用户）

| 当前 | 新名称 | 含义 |
|------|--------|------|
| `yiyue31-summary-generator` | `yiyue31-zhaiyao` | 摘要 |
| `yiyue31-takeaways` | `yiyue31-duhua` | 对话 |
| `yiyue31-personal-insights` | `yiyue31-biji` | 笔记 |

**优点**：中文用户一目了然
**缺点**：不符合国际化习惯，混合风格

### 方案E：简洁组合（推荐）

| 当前 | 新名称 | 含义 |
|------|--------|------|
| `yiyue31-summary-generator` | `yiyue31-summary` | 文章总结 |
| `yiyue31-takeaways` | `yiyue31-talk` | 对话观点 |
| `yiyue31-personal-insights` | `yiyue31-notes` | 学习笔记 |

**优点**：
- 简洁（单数名词）
- 对称（都是名词）
- 直观（summary/talk/notes 清晰区分）

---

## 推荐方案

### 第一推荐：方案E（简洁组合）

```bash
yiyue31-summary      # 文章总结（客观）
yiyue31-talk         # 对话观点（主观）
yiyue31-notes        # 学习笔记（综合）
```

**使用流程**：
```bash
# 用户工作流
1. /yiyue31-summary "https://example.com/article"    # 生成文章总结
2. /yiyue31-talk "基于文章讨论我的观点"              # 对话提取观点
3. /yiyue31-notes                                   # 整合为笔记
```

**命名逻辑**：
- `summary`：自动总结，无人参与
- `talk`：人机对话，提取观点
- `notes`：最终产物，学习笔记

### 第二推荐：方案B变体（输出导向优化）

```bash
yiyue31-article-summary    # 文章总结
yiyue31-viewpoints         # 我的观点
yiyue31-learning-report    # 学习报告
```

---

## 迁移成本

如果决定改名：

| 旧名称 | 新名称 | 迁移成本 |
|--------|--------|---------|
| `yiyue31-summary-generator` | `yiyue31-summary` | 低：目录重命名 |
| `yiyue31-takeaways` | `yiyue31-talk` | 中：需要更新引用 |

**建议**：
- 如果是新项目或用户不多：大胆改
- 如果已有用户：保留旧名，新 skill 用新名

---

## 新 Skill 命名选项（不改动旧 skills）

### 第一组：简洁型（单名词）

| 名称 | 含义 | 优点 |
|------|------|------|
| `yiyue31-notes` | 学习笔记 | 最简洁，符合直觉 |
| `yiyue31-report` | 学习报告 | 正式感强 |
| `yiyue31-digest` | 学习摘要 | 强调"消化吸收" |
| `yiyue31-insights` | 个人见解 | 强调深度思考 |

### 第二组：组合型（形容词+名词）

| 名称 | 含义 | 优点 |
|------|------|------|
| `yiyue31-learning-notes` | 学习笔记 | 清晰明确 |
| `yiyue31-study-report` | 学习报告 | 正式专业 |
| `yiyue31-personal-summary` | 个人总结 | 强调主观性 |
| `yiyue31-integrated-view` | 整合观点 | 体现合并功能 |
| `yiyue31-complete-notes` | 完整笔记 | 强调完整性 |
| `yiyue31-merged-insights` | 合并心得 | 直白描述功能 |

### 第三组：动作型（动词导向）

| 名称 | 含义 | 优点 |
|------|------|------|
| `yiyue31-merge` | 合并文档 | 极简，功能明确 |
| `yiyue31-integrate` | 整合文档 | 专业，但稍长 |
| `yiyue31-consolidate` | 巩固整合 | 强调学习闭环 |
| `yiyue31-compose` | 组合文档 | 文学化表达 |

### 第四组：中文拼音

| 名称 | 含义 | 优点 |
|------|------|------|
| `yiyue31-biji` | 笔记 | 中文用户秒懂 |
| `yiyue31-xinde` | 心得 | 强调个人收获 |
| `yiyue31-zongjie` | 总结 | 简单直接 |
| `yiyue31-hewang` | 合网 | 合并成网（整合） |

### 第五组：场景导向

| 名称 | 含义 | 优点 |
|------|------|------|
| `yiyue31-blog-post` | 博客文章 | 明确发布场景 |
| `yiyue31-study-log` | 学习日志 | 强调记录过程 |
| `yiyue31-knowledge-base` | 知识库 | 强调积累价值 |
| `yiyue31-learning-post` | 学习帖 | 适合论坛/博客 |

---

## 推荐排序

### 通用场景推荐

| 排序 | 名称 | 理由 |
|-----|------|------|
| 1 | `yiyue31-notes` | 最简洁，符合笔记直觉 |
| 2 | `yiyue31-learning-notes` | 清晰明确，不会混淆 |
| 3 | `yiyue31-digest` | 强调"消化吸收"，有深度 |
| 4 | `yiyue31-integrate` | 专业，体现合并功能 |

### 博客发布场景

| 排序 | 名称 | 理由 |
|-----|------|------|
| 1 | `yiyue31-blog-post` | 明确是博客文章 |
| 2 | `yiyue31-article` | 通用，文章感 |
| 3 | `yiyue31-publish` | 强调发布动作 |

### 个人回顾场景

| 排序 | 名称 | 理由 |
|-----|------|------|
| 1 | `yiyue31-notes` | 笔记就是给自己看的 |
| 2 | `yiyue31-study-log` | 学习日志，记录轨迹 |
| 3 | `yiyue31-knowledge-base` | 知识沉淀 |

---

## 最终建议

**最小改动方案**（不改旧 skills）：
- `yiyue31-notes` —— 最推荐
- `yiyue31-learning-notes` —— 最清晰
- `yiyue31-digest` —— 最有深意

---

## 待确认

- [ ] 从以上选项中选择，或提出新的想法
- [ ] 是否考虑整体改名（见前面方案）？
