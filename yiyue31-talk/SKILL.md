---
name: yiyue31-talk
description: 当用户要求"提取观点"、"生成心得"、"记录我的理解"、"写收获"、"我的想法"、"我对这篇文章的看法"时使用。用于生成用户观点文档，通过交互式讨论收集用户的理解、观点和收获。
---

# User Viewpoints Extraction Skill

通过交互式讨论生成用户观点文档，记录用户对文章的理解、观点和收获。

## Reusable Sub-workflows

### Evaluate Once

Single-shot evaluation: call subagent, get report, pass or fail.

**Parameters (caller provides):**
- `{eval-criteria}`: Checklist items for the subagent to evaluate
- `{input-files}`: File(s) to evaluate
- `{output-file}`: Where to save the evaluation report
- `{extra-output}`: Additional output fields beyond the default format (optional)

**Procedure:**
1. Call subagent with `{eval-criteria}` as evaluation standard, providing `{input-files}` content as input.
2. Subagent outputs: 总体评估(通过/不通过) + 问题列表 + 改进建议 + `{extra-output}`(if specified).
3. Save the evaluation report to `{output-file}`.
4. Not passed → adjust based on suggestions and re-evaluate. Max 3 rounds.
5. 3 rounds still not passed → show current version and report to user, let user decide.

**Returns:** PASS/FAIL + evaluation report path.

---

## title 安全化

仅保留字母、数字、CJK 字符、`-`、`_`，其余替换为 `-`，合并连续 `-`，去除首尾 `-`，限 64 字符。示例：`《AI 重塑软件开发：2026 年趋势》` → `AI-重塑软件开发-2026-趋势`。路径无效时用简短英文替代。

## 恢复逻辑

检查 `{title}/takeaways/` 下已有文件判断进度：

| 文件 | 完成步骤 |
|------|---------|
| `raw-{title}.md` | Step 1 |
| `analysis-raw-{title}.md` | Step 2 |
| `entities-{title}.md` 或 `entities-skipped-{title}.md` | Step 3 |
| `qa-{title}.md`（含讨论记录） | Step 4 |
| `output-detail-{title}.md` | Step 5 |
| `viewpoint-mapping-{title}.md` | Step 6 |
| `user-viewpoints-{title}.md` | Step 7 |

存在未完成工作 → 询问用户：继续 / 重新开始 / 跳转步骤。

---

## Workflow

### Step 1: 格式化输入

将用户输入转为 Markdown。输入来源：URL（优先用本地 skills 下载） / 文件路径 / 粘贴内容。title 安全化后保存。

保存：`{title}/takeaways/raw-{title}.md`

### Step 2: 分析原文

提取核心主题、文章类型与复杂度。按章节分析：关键观点、出彩表达（完整句子）、实体/术语、不可改写内容（数据/人名/公司名等）、讨论价值等级。

讨论价值：**高**=争议观点/深层概念/实践方法论；**中**=辅助论据/案例分析；**低**=引言/过渡/总结。

保存：`{title}/takeaways/analysis-raw-{title}.md`

**审查**（same pattern as **Evaluate Once**）：
- `{eval-criteria}`：核心主题准确无遗漏；章节划分完整，关键观点/出彩表达/实体/不可改写内容均已提取；讨论价值分级合理，高价值未被标低
- `{input-files}`：分析结果文件
- `{output-file}`：`{title}/takeaways/review-step2-analysis-{title}.md`

### Step 3: 实体关系图（可选）

AI 判断复杂度：技术架构/系统设计 → 建议生成；个人心得/经验分享 → 可跳过。询问用户选择。

支持：思维导图 / ER 图 / 流程图（Mermaid）。保存到 `{title}/takeaways/entities-{title}.md`（跳过则创建 `entities-skipped-{title}.md`）。

生成后请用户确认实体准确、关系完整。

### Step 4: 交互式讨论

仅对"高""中"价值章节提炼话题：高价值 3-5 话题（各 3 引导问题），中价值 1-2 话题（各 2-3 问题），总上限 20。问题须具启发性和深度。

**话题保存到 `{title}/takeaways/qa-{title}.md`。**

**流程**：
1. 展示话题列表（AskUserQuestion 多选），用户选择
2. 逐话题深入讨论（自由文本对话，不用预设选项）：
   - AI 先用自己理解引入话题，再邀请用户评价或补充
   - 每话题至少 3 轮往复
   - AI 可挑战用户观点，对每个观点提正反追问
   - 每话题结束后 AI 总结用户观点、偏好、侧重点、对应原文段落
   - **切换话题必须用户确认**（AskUserQuestion：继续下一个 / 深入当前 / 跳过剩余进下一步）
3. **退出讨论必须用户确认**，AI 不得自行跳过

讨论记录追加到 `{title}/takeaways/qa-{title}.md`，格式：话题 → AI 引导 → 用户原话 → AI 总结 → 对应段落 → 追问 → 用户原话 → AI 总结 → ...

### Step 5: 输出详细程度

AskUserQuestion：简洁版（观点概览+总结）/ 详细版（+逐话题详情+对话记录）。

保存选择到 `{title}/takeaways/output-detail-{title}.md`

### Step 6: 观点映射

从 qa 记录提取所有用户观点，生成映射表（保存到 `{title}/takeaways/viewpoint-mapping-{title}.md`）：

| 观点ID | 用户观点摘要 | 对应原文段落 | 来源话题 | 目标章节 | 放置方式 | 优先级 |
|-------|------------|------------|---------|---------|---------|-------|

放置方式：独立段落 / 融入正文 / 对比展示。

**审查**（same pattern as **Evaluate Once**）：
- `{eval-criteria}`：所有用户观点均已提取，摘要准确；映射章节合理，放置方式恰当，优先级正确；未映射观点已记录；遗漏率 > 0% 则不通过
- `{input-files}`：讨论记录 + 映射表
- `{output-file}`：`{title}/takeaways/review-step6-mapping-{title}.md`
- `{extra-output}`：观点覆盖验证(总数/已映射/遗漏数/遗漏率)

用户确认映射表后进入 Step 7。

### Step 7: 生成观点文档

**强制要求**：映射表每条观点均须体现；保留原文位置；数据/名称保持原值；明确区分"原文内容"与"我的观点"。

**生成内容**（根据 Step 5 选择）：
- 观点概览：核心关注 / 我的理解 / 我的异议
- 观点详情（详细版）：按话题组织，含原文位置、原文观点、用户观点、对话记录
- 总结：关键启示 / 实践建议 / 适用边界
- 附录：原文结构概览

保存到 `{title}/takeaways/user-viewpoints-{title}.md`

**审查**（same pattern as **Evaluate Once**）：
- `{eval-criteria}`：观点覆盖率 100%（零容忍遗漏）；原文与用户观点明确区分，无混淆；原文核心观点/数据/章节均已覆盖；可读性通顺、逻辑连贯；相比直接总结有个性化价值，否则不通过
- `{input-files}`：生成文档 + 映射表 + 讨论记录
- `{output-file}`：`{title}/takeaways/review-step7-quality-{title}.md`
- `{extra-output}`：观点体现情况(总数/已体现/遗漏/体现率) + 可读性评分(1-10) + 发布准备度 + 按严重程度(严重/中等/轻微)排列的问题

用户确认后，任务完成。
