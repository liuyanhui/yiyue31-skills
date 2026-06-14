# Planner & Orchestrator Skill 改进分析（含 subagent 对抗评审）

- **生成日期**：2026-06-14
- **评估对象**：
  - planner：`D:\liuyh\code\project\github\yiyue31-skills\engineering\planner\SKILL.md`
  - orchestrator：`D:\liuyh\code\project\github\yiyue31-skills\engineering\orchestrator\SKILL.md`
- **来源**：一次「简化 `pull-all-git-repos.sh`」的完整 planner→orchestrator 实战会话。
- **评审结论**：分析整体 **SOUND**——下述 7 条断言全部经 skill 原文核实，无一歪曲；P1 / O1 列 HIGH 合理。评审同时修正了几处定级/措辞，并补出若干遗漏项，已在文中标注。

---

## 一、planner 需完善项

### P1（HIGH，CONFIRMED）—— 缺「标准-任务作用域对齐」评审维度（本次最大的坑）
- **现象**：planner 两轮 Generator→Reviewer 都没发现——删除任务（原 T-002）的验收标准是「全文件名消失 `grep -c 'retry_git_command' → 0`」，但这些名字的**调用点**在 `process_repo`（T-003）和 report（T-005）里，T-002 这一任务上根本不可达成。直到 orchestrator 执行到 T-001/T-002 才暴露，被迫整体 re-plan。
- **根因（原文支撑）**：planner 的 10 个对抗评审维度（SKILL.md 第 70-81 行）里，没有一个查「每条标准在所属任务运行时的代码状态下是否可达成」。「Criteria Verifiability」（第 75 行）只查客观 yes/no，不查作用域可达。
- **修复（稳健）**：新增一个评审维度 **Criterion-Task Scope Alignment**；并在 Generator 的 brief 里加同一条约束（Generator 现在第 150-159 行无此指导）。

### P2（MED，CONFIRMED）—— 对单文件增量重构无指导
- **现象**：把单脚本重写拆成「删定义→重写 process_repo→改 dispatch→改 report」，中间态必然「定义已删、调用点还在」。
- **根因**：颗粒度指南（第 87-89 行）只有一句「实现与测试同任务」，对悬空引用中间态零指导。
- **修复（稳健）**：补一段——单文件多步重构时，要么让每任务到达无悬空引用一致态，要么把删除标准锚定到定义级、把全文件级断言集中到最后代码任务。

### P3（原 LOW → 评审建议 MED，CONFIRMED）—— 不感知部分已完成状态
- **现象**：re-plan 时 T-001 已 passed，必须**逐字复刻** T-001 才能让 orchestrator 跳过。
- **根因**：planner Initialization（第 26-35 行）只备份 `task-list.md`，不读 `task-progress.json`，无「已完成勿重跑」概念。
- **定级调整理由**：orchestrator 仅在 task-progress.json **精确匹配** `passed`（第 19-20 行）时跳过，「逐字复刻」变通很脆，Task-ID/描述稍漂移就会重跑已完成任务。
- **修复（方向稳健，细节需补）**：planner 启动读 `task-progress.json`；但需明确规定：保留已 passed 任务的 Task-ID 与描述不变（仅靠「读」不够，要保匹配语义）。

---

## 二、orchestrator 需完善项

### O1（HIGH，CONFIRMED）—— 「只读 Evaluator」与「需运行/造夹具的行为类标准」结构性冲突
- **现象**：T-003 C6、T-005 C5-C7、T-008 等标准需运行脚本/造临时夹具/跑测试套件，但 Evaluator 被第 33 行「严格只读，绝不创建/修改/删除任何文件」卡死。全程打补丁：把行为标准「DEFER 到 T-008」、或让 Evaluator 跑测试套件（套件内部造临时仓——灰色地带，实为违反第 33 行）。
- **根因**：skill 把「不要改交付物」和「绝不碰文件系统」混为一谈。
- **修复方案评估**：
  - **方案 A（放宽 Evaluator 可写 /tmp 夹具）：DUBIOUS，建议放弃**——侵蚀 skill 刻意建立的只读角色边界；夹具清理失败会悄悄污染验证；与「Generator 才是文件生产者」（第 32 行）冲突，模糊谁可写。
  - **方案 B（独立、可写夹具的验证子代理）：较稳妥但集成非平凡**——保留 Evaluator 只读纯度，但与「同一时刻只一个子代理」（第 34 行）、`disable-model-invocation: true`（第 5 行）冲突，需专门设计。
  - **更根本的解法**：见第三节遗漏项 #3——让 planner 在计划期就标注哪些标准「需运行/可只读」，从源头减少 Evaluator 的窘境。

### O2（MED，CONFIRMED，但框错了修复点）—— 无「标准归属后续任务」的概念
- **现象**：orchestrator 状态集（第 50-58 行）只有 pending/in-progress/evaluating/passed/failed/blocked，无 deferred；我临时发明 "DEFERRED to T-008"。
- **真正缺口（评审修正）**：不是「缺一个 DEFER 状态标签」，而是 skill **没有『某条标准的验证属于后续任务』这一概念**（标准归属模型缺失）。光加 `deferred` 状态是创可贴——标准本身仍被错误地挂在 T-001 上。
- **修复**：在「标准归属」层做——允许一条标准声明「由 T-00X 验证」，而非只加状态枚举。

### O3（LOW，CONFIRMED，修复方案 dubious）—— Plan Issues 处理过于二元
- **现象**：Plan Issues（第 224-233 行）只给两条路：用户手改 / 整体重规划。
- **修复（DUBIOUS，建议不做）**：现有「用户手改→重读」（第 230-231 行）已覆盖范围受限补丁；新增 orchestrator 居中补丁通道有违反 Core Principle 6（第 41 行「不得增删/重排任务，不静默调整」）的风险，价值低。

### O4（LOW，CONFIRMED，措辞过重）—— 每任务簿记开销大
- **现象**：每任务要改 task-list.md 状态 + 写 task-progress.json + 写 per-task observe-log（第 91-93 行）。
- **措辞修正**：observe-log 规则是「每事件一行」（第 93 行），真实成本是**文件增殖/目录杂乱**，不是 token 体积。
- **修复（方向稳，需细化）**：可改为追加到单个滚动 `observe-log.md`，而非每任务一文件；但三处写入目的不同，progress.json 注明「完整细节见日志」（第 92 行），合并会损失审计链，需权衡。

---

## 三、评审补充：原分析遗漏的 orchestrator 侧贡献因素

1. **Evaluator 作用域盲区**（P1 的 orchestrator 对偶面）：Evaluator 只拿「本任务标准+交付物，不给其它任务历史」（第 82、143-144 行），**结构上看不见**多任务重构状态，无法判断 T-001 的全文件 grep 会在后续任务才成立。
2. **Generator 收不到评估标准**（第 122-123 行明令不给）：Generator 无法主动做作用域护栏。这同时导致了 T-001 失败**和** T-006 注释里出现禁用中文（Generator 不知道禁用串连注释也算）。
3. **Evaluation Method 仅描述性**：Task 模板的 `Evaluation Method`（第 100-102 行）只是描述（manual/automated/code review），没把「需运行 vs 只读」变成**约束**——这是 O1 的 planning 侧根因。
4. **`disable-model-invocation: true`**（第 5 行）：orchestrator 不能被 model 自动调用；任何「让 orchestrator 自己调夹具子代理/放宽自身约束」的修复都要先过这关。
5. **re-dispatch 多标准脆性**：两个 skill 的 Shared Re-Dispatch 都说「勿改通过的部分」，但没指导「修一条失败标准是否会回退伤及已通过标准」（单文件重构常见）。

---

## 四、修复方案稳健性总览

| 方案 | 稳健性 | 说明 |
|------|--------|------|
| P1 加「作用域对齐」维度 + Generator 约束 | ✅ 稳健 | 低成本，直击本次最大坑，契合现有 10 维表结构 |
| P2 单文件重构颗粒度指南 | ✅ 稳健 | 一句话补充 |
| P3 planner 读 task-progress.json | ✅ 方向稳，需补匹配语义细节 |
| planning 侧 Evaluation Method 升级为「运行/只读」约束 | ✅ 稳健（评审新增） | 打通 O1 根因 |
| Generator 可见与自身相关的标准约束摘要 | ✅ 稳健（评审新增） | 防 T-006 式盲改 |
| O1 方案 A（放宽只读 Evaluator） | ⚠️ 放弃 | 侵蚀角色边界 |
| O1 方案 B（独立夹具验证子代理） | 🟡 需设计 | 与「单子代理」「disable-model-invocation」冲突 |
| O2 加 DEFER 状态标签 | ⚠️ 仅创可贴 | 真因在标准归属模型 |
| O3 居中 plan-patch 通道 | ⚠️ 不建议 | 现有手改路径已覆盖，且有违规风险 |
| O4 合并簿记 | 🟡 需细化 | 注意保留审计链 |

---

## 五、建议优先级

1. **P1**（最高收益、最低风险）——加「Criterion-Task Scope Alignment」评审维度 + Generator 同约束。
2. **planning 侧 `Evaluation Method` 升级为「需运行/可只读」约束**——从源头缓解 O1。
3. **Generator 可见与自身相关的标准约束摘要**——防 T-006 式盲改。
4. **P2** 单文件重构颗粒度指南。
5. **P3** planner 读 progress（带匹配语义细节）。
6. **O1 方案 B** 作为需设计项单列（不急着上）。
7. O2/O3/O4 视情况，低优先。

---

## 附：关键证据（skill 行号）

**planner SKILL.md**
- 10 个评审维度：第 70-81 行（无作用域对齐维度）
- Criteria Verifiability 定义：第 75 行（只查客观 yes/no）
- 颗粒度指南：第 87-89 行（仅「实现+测试同任务」）
- 任务状态生命周期：第 106 行（无 deferred）
- Initialization：第 26-35 行（不读 task-progress.json）
- Generator 系统提示：第 150-159 行（无作用域可达指导）

**orchestrator SKILL.md**
- Evaluator 严格只读：第 33 行
- Orchestrator 不产交付物：第 32 行
- 同一时刻只一个子代理：第 34 行
- Core Principle 6（不增删/重排任务）：第 41 行
- 状态生命周期：第 50-58 行（无 deferred）
- 跳过 passed 任务：第 19-20 行（精确匹配）
- Generator 不收评估标准：第 122-123 行
- Evaluator 仅本任务作用域：第 82、143-144 行
- 每任务簿记：第 91-93 行（observe-log「每事件一行」）
- Plan Issues 二元处理：第 224-233 行
- `disable-model-invocation: true`：第 5 行
