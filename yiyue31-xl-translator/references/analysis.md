# 译前分析细则（analysis）— Step 2 细则

> SKILL.md Step 2 只留产物清单与关卡；生成细则在本件（§6.1 #8 迁出：glossary 打回/投影）。

## 文风基准卡与标题树预译

- 文风基准卡：按 `{skill-dir}/references/style-card.md` 生成 `style-card.md`——原文文风特征转写为中文写作规则，含**文体变化轴**；文体分化的书按部设多锚点。
- 全文标题树预译：正文/目录标题照抄既定译名（预译表是标题双语锚的分母）。

## glossary 一条一译（脚本执行）

- **双选打回**：脚本扫双选条目 → 自动打回重裁定直至零双选（**双选打回 ≤3 轮**，超限转 PENDING-USER）。
- **既定译法投影**：脚本按各 chunk 原文扫描生成（大小写/单复数归一，取该 chunk 将出现的条目子集）——handoff.mjs 物化 `handoff/projection-chunk-<NN>.md`，verify-mech R8-c 消费。
- **>64KB 大表**：改 subagent 分段提取 + 脚本合并去重（主 agent 不整读原文，守 O(1)）。
