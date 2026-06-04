# hn-digest 架构设计

## 设计目标

按优先级排列：

1. **文章质量**：输出准确、结构清晰、读起来自然的文章
2. **Token 效率**：最小化 LLM 调用次数和 token 消耗
3. **架构简洁**：减少协调复杂度，降低维护成本
4. **可观测性**：中间产物（草稿、评估报告）持久化，便于调试和迭代

## 约束条件

| 约束 | 当前值 | 扩展场景值 | 来源 |
|------|--------|-----------|------|
| 典型帖子过滤后评论数 | 10-30 条 | 100-500 条 | HN 热帖 vs Reddit 长帖 |
| 单次任务数据量 | 15K-25K token | 80K-150K token | 估算 |
| 上下文窗口 | 200K token | 200K token | Claude 模型规格 |
| 数据量与窗口比 | < 15% | 40-75% | 计算值 |

**结论**：当前数据量远低于窗口上限，主 agent 可以持有全部数据。扩展场景下数据量可能逼近窗口上限，需要更复杂的架构。

---

## 当前方案：主 agent + 评估 subagent

适用于数据量 < 30% 窗口的场景。

### 架构

```
主 Agent（持有全部数据，执行全流程）
├── Steps 1-7：解析、配置、抓取、过滤、分组（主 agent 直接执行）
├── Step 8：生成文章 → 评估 subagent 评估 → 主 agent 修订（循环）
├── Step 9：评估 subagent 评估 AI tone → 主 agent 修复（循环）
├── Step 10：评估 subagent 评估 translationese → 主 agent 修复
└── Step 11：评估 subagent 评估 readability → 主 agent 修复 + 最终输出
```

### 角色定义

| 角色 | 职责 | 可读写 |
|------|------|--------|
| 主 agent | 全流程执行：生成、修订、修复、文件操作 | 所有文件 |
| 评估 subagent | 独立评估文章质量，输出评估报告 | 只读文章，只写评估报告，不修改任何内容文件 |

### 核心决策

1. **主 agent 持有全部上下文**：评论、分组结果、文章内容、评估报告都在主 agent context 中。修复时主 agent 结合写作意图 + 评估反馈做精准修改。
2. **评估 subagent 只评估不修改**：评估者专注于找问题，不分散注意力到修复上。详见决策 3 理由。
3. **典型 subagent 调用次数**：~7 次（Step 8 × 3 + Step 9 × 2 + Step 10 × 1 + Step 11 × 1）。

### 不足

- 如果数据量增长到 100K+ token，主 agent context 会逼近窗口上限
- 所有修复操作依赖主 agent 的单一 context，无法并行

---

## 扩展方案：三角色隔离架构

适用于数据量 > 30% 窗口、或需要并行处理、或需要更强隔离的场景。

**当前不启用**，但完整设计方案记录于此，需要时直接实施。

### 架构

```
主 Agent（只做编排，不持有内容数据）
├── Steps 1-6：解析、配置、抓取、过滤（主 agent 执行，数据量可控）
├── Step 7：分组 subagent（大数据量时按批派遣）
├── Step 8：生成 subagent 生成 → 评估 subagent 评估 → 生成 subagent 修订（循环）
├── Step 9：评估 subagent 评估 → 生成 subagent 修复 AI tone（循环）
├── Step 10：评估 subagent 评估 → 生成 subagent 修复 translationese
└── Step 11：评估 subagent 评估 → 生成 subagent 修复 readability + 最终输出
```

### 角色定义

| 角色 | 可读 | 可写 | 不可写 |
|------|------|------|--------|
| **主 agent** | 评估报告中的判定行/分数；配置值；post 元数据 | `01-raw-data.json`（数据转存）；`final-*.md`（文件复制） | 完整文章全文、完整评论、完整评估报告、`02-grouped.json` 内容 |
| **评估 subagent** | `readFiles` 参数指定的文件 + 评估 prompt | 评估报告文件（`writeFiles` 指定） | 任何内容文件（文章、grouped.json、raw data 等） |
| **生成 subagent** | `readFiles` 指定的输入 + 上一轮生成产物 + 评估报告 | 生成产物文件（`writeFiles` 指定） | 评估报告 |

### 主 Agent 上下文控制规则

主 agent 必须严格控制自身 context 大小：

1. **评估报告**：只读判定行或分数，不读报告全文。
   - Step 8：只读 `Overall Score: X/10` 行
   - Step 9：只读 `Verdict: NO ISSUES REMAIN` 或 `Verdict: ISSUES FOUND (N issues)` 行
   - Step 10/11：只读 `Summary` 行
2. **文章内容**：主 agent **永远不读**任何文章文件（`03-article.md`、`article-draft-round*.md`）。所有文章工作通过 subagent + 文件路径完成。
3. **评论数据**：主 agent 在 Step 6 中处理评论。如果数量大，分批处理，不在单个 context 中加载全部评论。
4. **`02-grouped.json`**：主 agent 不读此文件内容，只确认文件存在。
5. **原则**：主 agent 通过文件路径传递数据，不通过 context 传递。主 agent context 只保留流程控制信息、配置值、post 元数据、判定结果摘要。

### 参数传递机制

主 agent 每次派遣 subagent 时，必须显式传入：

- `readFiles`：subagent 被允许读取的文件路径数组
- `writeFiles`：subagent 被允许写入/覆盖的文件路径数组

subagent 不得读写超出这些列表的任何文件。

### Step 7 扩展：分组 subagent

当过滤后评论 > 40 条时：

1. 分成每批约 20 条评论
2. 每批派遣一个分组 subagent：
   - `readFiles`：该批评论（内联传递）、`{skill-dir}/assets/grouped-example-{templateVersion}.json`
   - `writeFiles`：`{outputDir}/{postId}/02-grouped-batch{N}.json`
3. 主 agent 合并各批结果：同组合并，`commentIds` 去重

### Step 8 扩展：生成/评估 subagent 循环

**Round 1：**

1. 派遣**生成 subagent** 生成文章：
   - `readFiles`：`02-grouped.json`、post 元数据（从 `01-raw-data.json`）、过滤后评论、`article-{templateVersion}.md` 模板
   - `writeFiles`：`article-draft-round1.md`
2. 派遣**评估 subagent** 评估文章：
   - `readFiles`：`article-draft-round1.md`、`01-raw-data.json`（准确性交叉检查）、`02-grouped.json`（按组覆盖检查）
   - `writeFiles`：`evaluation-article-round1.md`
3. 主 agent 只读 `Overall Score: X/10` 行判定通过/失败

**Rounds 2-3：**

1. 派遣**生成 subagent** 修订文章：
   - `readFiles`：同 Round 1 + 上一轮 draft + 上一轮 evaluation report
   - `writeFiles`：`article-draft-round{N}.md`
2. 派遣**评估 subagent** 评估修订（同 Round 1 模式）
3. 主 agent 只读分数行判定

### Steps 9/10/11 扩展：评估 → 生成 subagent 修复

每个质量检查步骤拆分为两阶段：

1. **评估阶段**：派遣评估 subagent 读文章、写报告（不改文章）
2. **修复阶段**（仅在发现问题时）：派遣生成 subagent 读报告 + 当前文章、写修复后的文章

需要为每个步骤创建独立的生成 prompt 文件：

- `references/fix-ai-tone-prompt.md`：读 AI tone 评估报告，逐一修复文章中的 AI 语气问题
- `references/fix-translationese-prompt.md`：读 translationese 评估报告，逐一修复翻译腔问题
- `references/fix-readability-prompt.md`：读 readability 评估报告，逐一修复可读性问题

每个 fix prompt 应包含：
- 输入说明（文章文件 + 评估报告文件）
- 修复规则（只修复报告中指定的问题，不做额外修改）
- 保护规则（保留 disclaimer 行、OP 标记、参考资料节）
- 文件访问约束（`readFiles`/`writeFiles` 范围）

### subagent 调用次数

典型场景（30 条评论、3 轮 generate-evaluate、2 轮 AI tone fix）：

| 阶段 | 调用次数 |
|------|---------|
| Step 8 生成 × 3 轮 | 3 |
| Step 8 评估 × 3 轮 | 3 |
| Step 9 评估 × 2 轮 | 2 |
| Step 9 修复 × 2 轮 | 2 |
| Step 10 评估 | 1 |
| Step 10 修复 | 1 |
| Step 11 评估 | 1 |
| Step 11 修复 | 1 |
| **合计** | **~14** |

### 何时切换到三角色架构

满足以下任一条件时，应从当前方案切换到三角色方案：

1. **数据量超过 60K token**（约 60 条过滤后评论）：主 agent context 开始拥挤，需要隔离
2. **扩展到其他平台**（Reddit、Twitter）：评论数可能 200+，数据量可能超过 100K token
3. **需要并行处理多个帖子**：主 agent 作为编排者调度多个独立 subagent
4. **需要更强的角色隔离**：评估质量和生成质量都要求独立的 subagent

### 实施清单

切换到三角色架构时需要修改的文件：

| 文件 | 改动 |
|------|------|
| `SKILL.md` | 将 "Subagent Architecture" 节替换为三角色定义 + 上下文控制规则；Steps 7/8 加入 readFiles/writeFiles 声明；Steps 9/10/11 拆分为评估 → 生成两阶段 |
| `references/evaluate-ai-tone-prompt.md` | 确认已包含 "File Access Constraint" 节（✓ 已有） |
| `references/evaluate-translationese-prompt.md` | 同上（✓ 已有） |
| `references/evaluate-readability-prompt.md` | 同上（✓ 已有） |
| `references/fix-ai-tone-prompt.md` | 新建 |
| `references/fix-translationese-prompt.md` | 新建 |
| `references/fix-readability-prompt.md` | 新建 |
| `SKILL.md` References Index | 添加 fix-*.md 条目 |

评估 prompt 中的 "File Access Constraint" 节已经在当前版本中存在，切换时无需修改。

---

## 不变的决策

无论使用哪个方案，以下决策不变：

1. **评估 subagent 只评估不修改**：角色单一化原则。评估者专注于发现问题，不同时修复。
2. **机械操作不走 LLM**：抓取、过滤、文件操作等由脚本或主 agent 直接执行。
3. **中间文件全部保留**：草稿、评估报告持久化，不清理。
4. **评估 subagent 提供对抗性评估**：独立评估者不受生成者偏见影响，这是使用 subagent 的核心理由。

---
