# 命名问题分析

## 当前名称

| Skill | 含义 | 问题 |
|-------|------|------|
| `yiyue31-takeaways` | 通过对话提取用户观点 | "takeaways" 太抽象 |
| `yiyue31-personal-insights` | 合并 summary + takeaways | 与 takeaways 容易混淆 |
| `viewpoint` (内部术语) | 用户的具体观点 | 与 takeaways 同义 |

---

## 概念本质分析

### yiyue31-takeaways 的本质
- **过程**：交互式对话，AI 提问 → 用户回答
- **产出**：用户的观点、理解、疑问
- **特点**：动态、双向、深入讨论

### yiyue31-personal-insights 的本质
- **过程**：读取两个已有文档，按模板合并
- **产出**：完整的个人学习文档
- **特点**：静态、单向、整合

### viewpoint 的本质
- **含义**：用户表达的具体观点/看法
- **角色**：takeaways 的原子数据单位

---

## 命名维度

### 维度1：过程 vs 结果

| | 过程导向 | 结果导向 |
|--|---------|---------|
| takeaways | discuss / extract / interview | viewpoints / opinions |
| personal-insights | merge / combine | report / notes / summary |

### 维度2：单一 vs 综合

| | 单一功能 | 综合功能 |
|--|---------|---------|
| takeaways | 只提取用户观点 | - |
| personal-insights | - | 综合 article + user |

### 维度3：中文直觉

| 英文 | 中文联想 | 适合场景 |
|------|---------|---------|
| takeaways | 收获、要点、干货 | 简洁总结 |
| insights | 见解、洞察、启发 | 深度思考 |
| viewpoints | 观点、看法、立场 | 争议性话题 |
| notes | 笔记、记录、注 | 个人记录 |
| report | 报告、汇报、总结 | 正式文档 |

---

## 命名方案

### 方案A：强调"对话" vs "文档"

| 当前 | 建议 | 理由 |
|------|------|------|
| `yiyue31-takeaways` | `yiyue31-discuss` | 强调对话过程 |
| `yiyue31-personal-insights` | `yiyue31-learning-report` | 强调最终文档 |

**优点**：清晰区分过程和结果
**缺点**：discuss 太泛，不明确讨论什么

### 方案B：强调"提取" vs "整合"

| 当前 | 建议 | 理由 |
|------|------|------|
| `yiyue31-takeaways` | `yiyue31-extract-views` | 强调提取观点 |
| `yiyue31-personal-insights` | `yiyue31-merge-learning` | 强调整合学习 |

**优点**：功能描述准确
**缺点**：偏技术化，不够直观

### 方案C：强调"笔记"体系

| 当前 | 建议 | 理由 |
|------|------|------|
| `yiyue31-takeaways` | `yiyue31-discussion-notes` | 对话笔记 |
| `yiyue31-personal-insights` | `yiyue31-study-notes` | 学习笔记 |

**优点**：符合"笔记"的中文直觉
**缺点**：两个都是 notes，可能混淆

### 方案D：中文拼音/缩写（针对中文用户）

| 当前 | 建议 | 理由 |
|------|------|------|
| `yiyue31-takeaways` | `yiyue31-duhua` (对话) | 对话过程 |
| `yiyue31-personal-insights` | `yiyue31-xinde` (心得) | 最终心得 |

**优点**：中文用户一目了然
**缺点**：不符合国际化习惯

### 方案E：保留 takeaways，改另一个

| 当前 | 建议 | 理由 |
|------|------|------|
| `yiyue31-takeaways` | `yiyue31-takeaways` | 保留，已熟悉 |
| `yiyue31-personal-insights` | `yiyue31-learning-summary` | 强调学习总结 |

**优点**：向后兼容
**缺点**：takeaways 仍然不够直观

---

## 推荐

### 方案E（保留 takeaways）

理由：
1. `takeaways` 是常见术语，用户可以学习理解
2. 修改现有名称成本高
3. 只需要让新名称与 takeaways 形成对比

**具体命名**：
- `yiyue31-takeaways` → 保持不变
- `yiyue31-personal-insights` → `yiyue31-learning-summary` 或 `yiyue31-study-report`

**替代**：如果想更强调"整合"：
- `yiyue31-personal-insights` → `yiyue31-integrated-notes`

---

## 内部术语调整

| 当前 | 建议 | 理由 |
|------|------|------|
| `viewpoint` | `user-view` 或 `user-point` | 更简短 |
| `user-viewpoints-{title}.md` | `my-views-{title}.md` | 第一人称更直观 |

---

## 待确认

- [ ] 是否接受保留 `takeaways`？
- [ ] `personal-insights` 改成什么？
- [ ] 内部术语 `viewpoint` 是否需要调整？
