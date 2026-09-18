# HANDOFF：translator 家族双语输出 + translator 瘦身（2026-09-18）

> **用途**：换机 + 冷启动自足。新机器、新会话只读本文 + 仓库即可开工，不依赖任何会话记忆。
> **设计依据**：[yiyue31-translator-bilingual-discussion.md](./yiyue31-translator-bilingual-discussion.md)（第 1-7 轮讨论 + 结论汇总；用户输入逐字存档另见同前缀 `-user-inputs.md`）。
> **状态**：设计定稿，用户已全部拍板（2026-09-18），**实施未开始**。
> **冷启动入口**：换机后 `git pull` → 读本文档 → 从 **§2 Phase 0（三角色 subagent 评审）** 开始执行——这是用户指定的冷启动后第一个任务（2026-09-18 指令）。

## 任务总账（本会话全部任务 → 去向，防遗漏）

| # | 会话中提出的任务 | 去向 | 状态（2026-09-18） |
|---|---|---|---|
| 1 | 沟通记录存档（讨论记录 + 用户输入逐字存档，后者不可修改） | `docs/` 两份文档 | ✅ 完成 |
| 2 | 设计文档 commit + push（此后每任务/Phase 均执行同步纪律） | origin/master | ✅ 完成 |
| 3 | **三角色 subagent 评审（Phase 0）——冷启动后第一个任务** | §2 | ⬜ 待执行 |
| 4 | yiyue31-xl-translator 实现双语输出 | Phase 1（§3） | ⬜ 待开工 |
| 5 | yiyue31-translator 移除大文档（多 chunk）功能 | Phase 2（§4） | ⬜ 待开工 |
| 6 | yiyue31-translator 双语输出 | Phase 2 T2.4（§4） | ⬜ 待开工 |
| 7 | 实施完成后开发期文档清理（用户逐字存档永久保留） | §6 | ⬜ 待实施 |

---

## 0. 环境与仓库事实（换机重建）

- 仓库：`yiyue31-skills`（monorepo），origin `https://github.com/liuyanhui/yiyue31-skills.git`，master 直接提交。换机同步 = 本机 commit+push、新机 pull（上级目录有 `pull-all-git-repos.sh` 批量脚本）。
- 本机路径：`D:\liuyh\code\project\github\yiyue31-skills`（Windows + Git Bash；换机后以 clone 路径为准）。
- 运行时：Node.js。两 skill 脚本均为纯 Node（xl 用 `.mjs`，translator 用 `.js`），无 npm install 步骤。
- xl 测试入口：`bash scripts/test/run.sh`（全部，逐文件串行）；单文件 `node --test scripts/test/unit/<模块>.test.mjs`。**禁止 `node --test <目录>`**——多文件并行起进程，低内存机器 OOM（测试 README 明文纪律）。
- xl `scripts/test/` 是开发期资产，**不属于 SKILL.md 引用封闭集**（封闭集只管运行时引用文件；但 scripts/ 下新增运行时脚本要更新封闭集计数）。
- 相关仓库 `refined-stock`（`../refined-stock`）：本次改动不依赖其逻辑，但命名约束已内化（见 §1.1——bilingual 文件不以 `-zh.md` 结尾、无发布前缀，天然不命中其 classify）。

## 1. 已定决策（冷启动速览，勿再议）

1. **双语版总设计**：纯中文 `translated-<title>-zh.md` 永远是唯一交付物与管线终点；双语版 `translated-<title>-bilingual.md` = PASS 后由（交付物 × 原文）机械派生的**只读视图**——不经终检、sha 不锚、不受手修保护、幂等可重生成、命名永不以 `-zh.md` 结尾。两文件可并存（"一次拿到两个"），但不存在"只有双语版"的组合。
2. **交付/翻译解耦（设计不变量）**：翻译管线对输出格式选择零感知；brief 双语字段归**交付配置**（非翻译参数）；双语模式下**不放宽注释政策**（宁冗余，不反向影响翻译）。
3. **对齐策略（结构匹配首发）**：chunk 配对（manifest + 内容 sha，精确）→ 标题锚定节切分（**标题双语锚行 `*English Heading*` 优先**；brief 锚关时退化为标题级别+顺序）→ 节内块按序配对 + 代码块/URL 指纹校核 → 块数不匹配的节降级为节级对照，降级清单随输出可见。人工锚点（如 `<!-- b7 -->`）仅为降级率证实过高后的升级方案，**首发不做**。
4. **交错格式**：中文在上、英文在下；元信息头仅文件头出现一次；双语版中标题锚行保留不删；派生脚本**只交错、不改动任何块内容**。
5. **三拍板（2026-09-18 用户采纳）**：① translator >40KB 路由 = **提示+停止**（大小检查置于建目录/落盘之前，不落任何文件）；② 双语文件身份 = **交付物/派生视图二分**；③ 入口 = **动词 + brief 交付配置组合**（动词 `双语对照 <title>` 幂等生成/重生成，服务存量已交付项目）。
6. **实施序**：Phase 1 xl-translator 双语（独立增量，不碰承重墙）→ Phase 2 translator 瘦身（删除面大），各自独立提交。
7. **边角决策**：xl 交付物 sha 与 REPORT 锚不符（用户手改）时派生照跑 + WARN 一行；translator 旧多 chunk 进行中工程**不写迁移**，遇旧结构披露并给出口；translator 瘦身后 ≤40KB 行为与现状等价（小文本就走单 chunk subagent）。

## 2. Phase 0：三角色 subagent 评审（换机+冷启动后第一个任务）

**指令来源**：2026-09-18 用户定案——冷启动后第一个任务 = 启用 subagent 评审本次需求，先于 Phase 1 实施。

**执行方式**：三个**并行、单轮** subagent；只审文档、不改代码、不实施任何 Phase 1/2 内容。

| 角色 | 任务 | 输入 | 产出 |
|---|---|---|---|
| ① 冷启动读者 | 模拟新机新会话：只读本 HANDOFF + 仓库，回答"我该做什么/边界在哪/哪里卡住/缺什么信息"，暴露自足性缺口 | 本 HANDOFF | 自足性缺口清单 |
| ② xl 内核审查 | 对照 `yiyue31-xl-translator/SKILL.md` 逐机制核对 §1 决策有无冲突：命名三条红线（尤其③）/ 终检重执行哲学 / 状态机动词表 / brief 语义 / 交付后纪律 / status 文件系统推导 | 本 HANDOFF §1 + xl SKILL.md | 冲突清单（每条 = 决策点 × 机制 × 冲突描述） |
| ③ 删除面审计 | grep `yiyue31-translator` 全部 git 跟踪文件中对 `doc_segmenter`、`chunks`、`manifest`、`progress.json`、`consistency-checklist`、`translated-chunks` 的引用，核对 §4（Phase 2）删除/收缩清单完备性 | 本 HANDOFF §4 + translator skill 目录 | 遗漏清单（漏删/漏改的引用点） |

**收口**：三份清单合并去伪（逐条核验，误报剔除）→ 修订本 HANDOFF——**§1 已定决策的修订须先报备用户，任务级修订直接改** → commit + push → 进入 Phase 1（§3）。三角色零发现也要在提交信息记录"Phase 0 评审通过"。

**纪律**：subagent 只回传清单落盘路径 + 一行结论（对齐 xl 的回传纪律，保主上下文 O(1)）；评审发现不直接改 SKILL.md/代码——一切改动待 Phase 1/2 按序执行。

## 3. Phase 1：xl-translator 双语输出（先做）

**前置核验（动手第一步，结论写进提交信息）**：

- **T1.1** grep `final-gate.mjs` 的根目录文件枚举与重入前置条件——确认工作目录根多出 bilingual 文件不触发任何判定变化（现有证据：final-gate.mjs:487 只扫 `translated-chunks/chunks/adjudications/reviews` 子目录）。若发现冲突，处理优先级：豁免 glob 精确到该文件名 > 重入前先删后重生成（最下策）。
- **T1.2** 查 `segment/` 是否导出 fence 感知、块粒度的解析函数——**能 import 就复用；需重构 segment.mjs 才能复用就在新脚本内独立写**（约百行）。不为复用动 segment 内部结构（"拼接 sha === 原文 sha"关卡是全 skill 最承重墙）。

**主体任务**：

- **T1.3 新脚本 `scripts/derive-bilingual.mjs`**：
  - 输入：workdir 路径（含交付物 + `original-<title>.md` + `chunks/` + `manifest.md`）；无交付物 → 非零退出 + 可操作报错（风格对齐 merge.mjs 的 M6"绝不静默拼残稿"）。
  - 算法：按 §1.3；逐 chunk 交错后按 NN **数值序**拼接（禁字典序，对齐 merge 的 R29 纪律）。
  - 输出：`translated-<title>-bilingual.md` + 降级节清单（含对齐覆盖率统计）。
  - 交付物 sha ≠ REPORT 锚 → 照跑 + WARN 一行。
  - 幂等：同输入重跑字节相同，无时间戳无随机（对齐 M5）；只读纪律：绝不写交付物/原文/chunks。
  - 导出纯函数 `interleave` 供测试复用（仿 `merge.mjs` 的 `assemble` 被 final-gate 复用的先例）。
- **T1.4 测试**：`scripts/test/unit/derive-bilingual.test.mjs`（对齐正常 / 节降级 / 标题锚开与关 / 围栏内 `#` 跳过 / 无交付物退出码 / 幂等 / 只读）+ final-gate 回归 fixture"工作目录含 bilingual 文件 → 判定不变"（兑现 T1.1）。
- **T1.5 SKILL.md 接线**：红线③追加派生视图二分表述（措辞见讨论记录第 4 轮建议 2）；动词表新增 `双语对照 <title>`；brief 模板交付配置区新增 `双语对照: 关`（Step 0 落盘，PASS 后主 agent 查 brief，开则跑 T1.3）；**scripts 封闭集计数 9 → 10**；交付节补双语版说明一行；`status.mjs` 已交付态显示双语版是否已生成（一行，最小改动）。
- **T1.6** SKILL.md 版本 bump（0.3.x → 0.4.0）。

**验收**：`run.sh` 全绿；在一个真实已交付 workdir 上跑动词生成双语版并人工抽查交错正确性；模拟术语统一轻命令的终检重入，确认 bilingual 文件零影响。

## 4. Phase 2：yiyue31-translator 瘦身 + 双语

- **T2.1** Step 1 预处理改路由：>40KB → 回一行"本文约 XX KB，超过 40KB 上限，本 skill 不再处理大文档——请对同一输入改说『翻译大文档』（yiyue31-xl-translator）"并停止；**检查置于建目录/落盘之前**。
- **T2.2** 删 Step 1.5 + `scripts/doc_segmenter/` 整目录（含 node_modules 与自带 tests）；README 依赖段移除 bun。
- **T2.3** SKILL.md 工作流重构：路径表单文件化（`original-{title}.md` → `translated-{title}-zh.md`，报告 `review-{type}.md`）；Step 4/4.5/5/6/7/9 每维度一个 subagent 全文单次（**"维度不合并"审校纪律保留**）；Step 10 简化为元信息头 + 临时标记清理 + 字数统计；Step 11 整体删除（含 `scripts/consistency-checklist.js`，其存在理由就是分块）；Step 12 `verify-pipeline.js` 适配单文件（保留反伪造骨架：报告存在性/合规表/SKIPPED 披露/模板签名）；`verify-mechanical.js` 本身不改，调用改为整文件一次。
- **T2.4** 双语：新脚本 `scripts/derive-bilingual.js`（无 chunk 层：`original-{title}.md` × `translated-{title}-zh.md` 两文件交错；同结构匹配 + 节级降级 + 幂等；命名 `translated-{title}-bilingual.md`）；SKILL.md 记两种触发（发起时说了要双语 → 交付后跑；交付后随时补说）。
- **T2.5** 旧结构披露：SKILL.md 加一句——translation/ 目录含 `chunks/` 多 chunk 结构时披露"此工程由旧版流程创建"，给出口（git 历史版本跑完 or 删目录重新发起），不自动迁移。
- **T2.6** README.md 更新：工作流程行、设计决策档案（删"全局一致性不读整篇"等分块条目，其余承重墙保留）、脚本表（−doc_segmenter、−consistency-checklist、+derive-bilingual）、依赖段。
- **T2.7** SKILL.md frontmatter：description 注明小文章定位与 >40KB 路由提示；版本 2.5.0 → 3.0.0（破坏性变更）。

**验收**：≤40KB 文章全流程跑通（行为与现状等价）；>40KB 触发提示+停止且零落盘；旧多 chunk 目录触发披露；双语派生在单文件 workdir 上可用。

## 5. 实施纪律

- 偏离 §1 任何已定决策 → 先向用户报备取得同意，不得自作主张。
- 解耦不变量（§1.2）不可破：任何"输出格式影响翻译行为"的实现都是错的，发现即返工。
- 每个任务结束列出剩余未处理项（用户惯例）。
- **同步纪律（换机+冷启动前提）**：每个任务/Phase 的 commit 完成后立即 push——远端 origin 是唯一跨机事实源，本地未推送的提交在换机视角等于不存在。
- 提交信息按仓库现行风格（中文、类型前缀、说清 why）；Phase 0 / Phase 1 / Phase 2 各自独立提交。
- **多角色 review**：已定案并升格为 Phase 0（§2），冷启动后第一个任务——方案见 §2，此处不重复。

## 6. 完成后处置

- 本 HANDOFF 与讨论记录为开发期文档：实施完成后按仓库惯例删除，要义写入提交信息，git 历史作存档（仓库无常设 CHANGELOG，以 commit message 承载）。
- **例外**：`docs/yiyue31-translator-bilingual-discussion-user-inputs.md` 为用户逐字存档（用户明确要求原状保存），**永久保留，不随清理删除**。
