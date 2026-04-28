# 用户观点提取 Skill

此技能通过交互式讨论生成用户观点文档，记录用户对文章的理解、观点和收获。

## 功能特点

- **智能分析**：自动提取核心主题、实体名词、术语、金句和不可改写内容
- **交互式讨论**：AI与用户深入探讨文章内容，收集真实观点
- **观点映射**：确保每个用户观点都在最终文档中得到体现
- **可视化**：可选生成实体关系图（Mermaid代码）
- **多层次检查**：subagent参与分析、映射、生成环节的质量审查
- **中断恢复**：支持任务中断后继续，记录详细的进度状态

## 工作流程

1. 格式化输入文档
2. 分析原文（术语分析、金句提取）→ **subagent检查**
3. 生成实体关系图（可选，用户确认）
4. 交互式讨论与记录（话题级别进度保存）
5. 用户观点映射 → **subagent检查**（用户确认）
6. 选择输出详细程度（简洁版/详细版）
7. 生成用户观点文档 → **subagent检查**（用户确认）
8. 最终质量评估

## 中断恢复

任务状态保存在 `{title}/takeaways/state-{title}.json`：

```json
{
  "task_id": "uuid",
  "title": "文章标题",
  "current_step": 4,
  "status": "in_progress",
  "last_update": "2026-04-28T14:45:00Z",
  "steps": {
    "step1": {"status": "completed"},
    "step4": {"status": "in_progress", "current_topic": 2, "total_topics": 5}
  }
}
```

**恢复逻辑**：
- Skill 开始时检测 state 文件
- 存在且未完成 → 询问用户：继续/重新开始/跳转步骤
- Step 4（讨论）记录话题级别进度，支持精确恢复

## 输出文件汇总

每次任务生成的文件：

| 文件 | 说明 | 检查方式 |
|------|------|---------|
| state-{title}.json | 任务状态（恢复用） | - |
| raw-{title}.md | 原始文档 | - |
| analysis-raw-{title}.md | 分析结果 | subagent检查 |
| entities-{title}.md | 实体关系图（可选） | 用户确认 |
| qa-{title}.md | 讨论记录 | - |
| qa-gan-evalution-{title}.md | 话题审查报告 | subagent对抗审查 |
| viewpoint-mapping-{title}.md | 观点映射表 | subagent检查 + 用户确认 |
| output-detail-{title}.md | 输出格式选择 | - |
| user-viewpoints-{title}.md | 用户观点文档（最终输出） | subagent检查 + 用户确认 |

## 输出格式

**简洁版**：
- 观点概览（核心关注、我的理解、我的异议/补充）
- 总结（关键启示、实践建议、适用边界）

**详细版**：
- 观点概览
- 观点详情（按话题组织，含原文位置、对话记录）
- 总结
- 原文结构概览

## 使用方法

当您使用以下短语时，此技能会自动触发：
- "提取观点"、"生成心得"、"记录我的理解"
- "写收获"、"我的想法"、"我对这篇文章的看法"

## 相关文件

- `SKILL.md` - 详细的技能工作流程
- `references/` - subagent 审查指令
  - `step2-analysis-reviewer.md` - 分析结果审查
  - `step5-mapping-reviewer.md` - 观点映射审查
  - `step7-article-reviewer.md` - 文档生成审查
  - `step8-quality-reviewer.md` - 最终质量评估
