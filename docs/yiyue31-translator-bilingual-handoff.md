# HANDOFF：translator 家族双语输出 + translator 瘦身（2026-09-18）

> **用途**：换机 + 冷启动自足。新机器、新会话只读本文 + 仓库即可开工，不依赖任何会话记忆。
> **设计依据**：[yiyue31-translator-bilingual-discussion.md](./yiyue31-translator-bilingual-discussion.md)（第 1-9 轮讨论 + 结论汇总 + 待决项；用户输入逐字存档另见同前缀 `-user-inputs.md`）。
> **状态**：Phase 0（三角色评审）已完成（2026-09-19：六机制零硬冲突；23 条发现逐条核验零误报，已并入下文相应条款）；Phase 1/2 实施未开始。
> **冷启动入口**：换机后 `git pull` → 读本文档 → 从 **§3 Phase 1（xl-translator 双语输出）** 开始执行（Phase 0 已收口，勿重跑；其评审清单见 §2 执行记录）。

## 任务总账（本会话全部任务 → 去向，防遗漏）

| # | 会话中提出的任务 | 去向 | 状态（2026-09-18） |
|---|---|---|---|
| 1 | 沟通记录存档（讨论记录 + 用户输入逐字存档，后者不可修改） | `docs/` 两份文档 | ✅ 完成 |
| 2 | 设计文档 commit + push（此后每任务/Phase 均执行同步纪律） | origin/master | ✅ 完成 |
| 3 | **三角色 subagent 评审（Phase 0）——冷启动后第一个任务** | §2 | ✅ 完成（2026-09-19，修订已并入本文档） |
| 4 | yiyue31-xl-translator 实现双语输出 | Phase 1（§3） | ⬜ 待开工 |
| 5 | yiyue31-translator 移除大文档（多 chunk）功能 | Phase 2（§4） | ⬜ 待开工 |
| 6 | yiyue31-translator 双语输出 | Phase 2 T2.4（§4） | ⬜ 待开工 |
| 7 | 实施完成后开发期文档清理（用户逐字存档永久保留） | §6 | ⬜ 待实施 |

---

## 0. 环境与仓库事实（换机重建）

- 仓库：`yiyue31-skills`（monorepo），origin = `liuyanhui/yiyue31-skills`（本机配 SSH remote，clone 方式随新机凭据自选），master 直接提交。换机同步 = 本机 commit+push、新机 pull（上级目录有 `pull-all-git-repos.sh` 批量脚本）。
- 本机路径：`D:\liuyh\code\project\github\yiyue31-skills`（Windows + Git Bash；换机后以 clone 路径为准）。
- 运行时：Node.js。xl 全程纯 Node（`.mjs`）零安装；translator **现状** Step 1.5 依赖 bun + `doc_segmenter/node_modules`（T2.2 删除后消失，届时起 translator 亦纯 Node（`.js`）零安装）。
- xl 测试入口：`bash scripts/test/run.sh`（全部，逐文件串行）；单文件 `node --test scripts/test/unit/<模块>.test.mjs`。**禁止 `node --test <目录>`**——多文件并行起进程，低内存机器 OOM（测试 README 明文纪律）。
- xl `scripts/test/` 是开发期资产，**不属于 SKILL.md 引用封闭集**（封闭集只管运行时引用文件；但 scripts/ 下新增运行时脚本要更新封闭集计数）。
- 相关仓库 `refined-stock`（路径以新机布局为准，本机 `/home/claude/project/refined-stock`——与 monorepo 非兄弟目录）：本次改动不依赖其逻辑；命名约束已经 Phase 0 核验（C1）——其 classify 正则 `/^.+-zh\.md$/i` 锚定结尾（`scripts/lib.mjs:37`），bilingual 不以 `-zh.md` 结尾、无发布前缀，不命中。Phase 1 验收用已交付 workdir 在该仓库内（本机实证 3 个：AI-Native-SDLC-playbook、AI-Native-SDLC-playbook-r2、commerce-agents-anatomy）。

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

**执行方式**：三个**串行、单轮** subagent（本机全局纪律：禁止并行派发 subagent、低内存——一次派一个，等回传再派下一个）；只审文档、不改代码、不实施任何 Phase 1/2 内容。

| 角色 | 任务 | 输入 | 产出 |
|---|---|---|---|
| ① 冷启动读者 | 模拟新机新会话：只读本 HANDOFF + 仓库，回答"我该做什么/边界在哪/哪里卡住/缺什么信息"，暴露自足性缺口 | 本 HANDOFF | 自足性缺口清单 |
| ② xl 内核审查 | 对照 `yiyue31-xl-translator/SKILL.md` 逐机制核对 §1 决策有无冲突：命名三条红线（尤其③）/ 终检重执行哲学 / 状态机动词表 / brief 语义 / 交付后纪律 / status 文件系统推导 | 本 HANDOFF §1 + xl SKILL.md | 冲突清单（每条 = 决策点 × 机制 × 冲突描述） |
| ③ 删除面审计 | grep `yiyue31-translator` 全部 git 跟踪文件中对 `doc_segmenter`、`chunks`、`manifest`、`progress.json`、`consistency-checklist`、`translated-chunks` 的引用，核对 §4（Phase 2）删除/收缩清单完备性 | 本 HANDOFF §4 + translator skill 目录 | 遗漏清单（漏删/漏改的引用点） |

**收口**：三份清单合并去伪（逐条核验，误报剔除）→ 修订本 HANDOFF——**§1 已定决策的修订须先报备用户，任务级修订直接改** → commit + push → 进入 Phase 1（§3）。三角色零发现也要在提交信息记录"Phase 0 评审通过"。

**清单落盘约定**：三份清单写入 `docs/yiyue31-translator-bilingual-phase0-role{1,2,3}-<代号>.md`（coldstart / xl-kernel / deletion-audit），均为开发期产物，随 §6 清理删除。

**执行记录（2026-09-19）**：三角色串行执行完毕（角色②中途遇 API 限流 429 中断一次，恢复后续跑完成）。收口去伪：23 条发现逐条核验**零误报**——G1-G9（角色①）并入 §0/§2/头部；C1（角色②，refined-stock classify 待核验→已核验通过）结论入 §0；C2-C5 入 T1.5；M1-M9（角色③）入 T2.2/T2.3/T2.6/T2.7。§1 已定决策零改动。

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
- **T1.5 SKILL.md 接线**（含 Phase 0 角色② C2-C5、角色① G8）：红线③追加派生视图二分表述（措辞见讨论记录第 4 轮建议 2）；动词表新增 `双语对照 <title>`，且 **frontmatter description 触发词同步补 `双语对照`**（C4：动词必入触发词是本 skill 惯例，漏则存量项目说动词唤不起 skill）；brief（扁平 key:value，无模板文件/分区）新增一行 `双语对照: 关`（G8：概念归交付配置；解析仿 `标题双语锚` 先例 final-gate.mjs:134，不入 KEYMAP、机械校验零可见；Step 0 落盘，PASS 后主 agent 查 brief，开则跑 T1.3）；Step 0 预算公告的 brief 披露行同步枚举 `双语对照关`（C5：通知非询问——用户须从此处知晓全部可改项）；**scripts 封闭集计数 9 → 10**；交付节补双语版说明一行，**必须含显式豁免句**"派生视图生成不触发 sha 不符询问——派生只读不覆盖交付物，WARN 一行即止"（C2：否则与「交付后」"再入不符 = 询问"规则字面打架，执行 agent 无所适从）；`status.mjs` 已交付态显示双语版**三态**：未生成 / 已生成（基于当前交付物）/ 已过期（交付物已更新，重说"双语对照 <title>"再生成）（C3：restart / 术语统一再 PASS / re-keying 三路径都让旧双语版静默滞留，"是否已生成"一字段会掩盖过期）；配套 T1.3 在 bilingual 元信息头嵌**源交付物 sha**（确定性字段，不破坏幂等），三态据此判定。
- **T1.6** SKILL.md 版本 bump（0.3.x → 0.4.0）。

**验收**：`run.sh` 全绿；在一个真实已交付 workdir 上跑动词生成双语版并人工抽查交错正确性；模拟术语统一轻命令的终检重入，确认 bilingual 文件零影响。

## 4. Phase 2：yiyue31-translator 瘦身 + 双语

- **T2.1** Step 1 预处理改路由：>40KB → 回一行"本文约 XX KB，超过 40KB 上限，本 skill 不再处理大文档——请对同一输入改说『翻译大文档』（yiyue31-xl-translator）"并停止；**检查置于建目录/落盘之前**。
- **T2.2** 删 Step 1.5 + `scripts/doc_segmenter/` 整目录（含 node_modules 与自带 tests；**必须 `rm -rf`**——`git rm` 不碰未跟踪内容，目录内 node_modules 与 Windows 误建 `D:/` 空目录树随之前消失）。bun 引用随 Step 1.5 与整目录删除自然消失，**README 依赖段本就无 bun**（M5）；依赖段真正要删的是 `Python >= 3.10`（全 skill 已零 Python 消费），可选顺带清根 `.gitignore` 的 `__pycache__/` 行。
- **T2.3** SKILL.md 工作流重构：路径表单文件化（`original-{title}.md` → `translated-{title}-zh.md`，报告 `review-{type}.md`）；Step 4/4.5/5/6/7/9 每维度一个 subagent 全文单次（**"维度不合并"审校纪律保留**）；Step 10 简化为元信息头 + 临时标记清理 + 字数统计；Step 11 整体删除（含 `scripts/consistency-checklist.js`，其存在理由就是分块）；Step 12 `verify-pipeline.js` 适配单文件（保留反伪造骨架：报告存在性/合规表/SKIPPED 披露/模板签名；**七类检查逐项明示去留**——"时序一致性""尺寸下限"在单文件下仍有判定对象，勿机械只留四项）。**verify-results.json 反伪造链保留**（M1，最重遗漏：v2.5.0 立"杀'声称已跑'式伪证"防线，单文件下会因 verify-mechanical.js:234 目录门 `!== "translated-chunks"` 而**静默断裂**——该旁路异常不报错）：对"本身不改"开一行明示例外，L234 目录门放宽为 `translation/` 根亦落盘；SKILL.md:139（Step 4.6 落盘声明句，原步骤枚举漏了 Step 4.6）相应保留适配；`verify-mechanical.js` 其余不改，调用改为整文件一次。**Step 12 散文适配**（M2/M3，原条款只管脚本）：L226 删 `consistency-{title}.md` 查询句（Step 11 删后该文件永不产生）；L228 红旗来源去"一致性离群"；L233 rework 路由去"一致性→Step 11"分支；② 抽样通读计数单位从 chunk 改全文/段落级（如"通读 ≥2 个章节 + 密度 WARN 触发段"）。**散点措辞**（M7/M8）：功能描述删"分段、"（L12）；Step 2 术语表理由句去 chunk 表述（L63）。**references/**（M6）：`evaluate-readability-prompt.md:13` "单 chunk 中文译文"→"整篇中文译文"（改前按共享评审 prompt 同步纪律查有无兄弟拷贝需同步）。
- **T2.4** 双语：新脚本 `scripts/derive-bilingual.js`（无 chunk 层：`original-{title}.md` × `translated-{title}-zh.md` 两文件交错；同结构匹配 + 节级降级 + 幂等；命名 `translated-{title}-bilingual.md`）；SKILL.md 记两种触发（发起时说了要双语 → 交付后跑；交付后随时补说）。
- **T2.5** 旧结构披露：SKILL.md 加一句——translation/ 目录含 `chunks/` 多 chunk 结构时披露"此工程由旧版流程创建"，给出口（git 历史版本跑完 or 删目录重新发起），不自动迁移。
- **T2.6** README.md 更新：工作流程行、设计决策档案（删"全局一致性不读整篇"等分块条目，其余承重墙保留）、脚本表（−doc_segmenter、−consistency-checklist、+derive-bilingual）、依赖段（见 T2.2）、**删"文章分段"整节**（M4：L23-25 描述已删机制，且"详见 doc_segmenter/README.md"在 T2.2 后成悬空指针）。
- **T2.7** SKILL.md frontmatter：description 注明小文章定位与 >40KB 路由提示；版本 2.5.0 → 3.0.0（破坏性变更）；**translator/CHANGELOG.md 补 v3.0.0 条目**（M9/G2：删多 chunk/doc_segmenter/Step 11、>40KB 路由、双语派生、verify-results 链处置——该 CHANGELOG 逐版本活跃记录是 skill 自身惯例，原清单漏配）。

**验收**：≤40KB 文章全流程跑通（行为与现状等价）；>40KB 触发提示+停止且零落盘；旧多 chunk 目录触发披露；双语派生在单文件 workdir 上可用。

## 5. 实施纪律

- 偏离 §1 任何已定决策 → 先向用户报备取得同意，不得自作主张。
- 解耦不变量（§1.2）不可破：任何"输出格式影响翻译行为"的实现都是错的，发现即返工。
- 每个任务结束列出剩余未处理项（用户惯例）。
- **同步纪律（换机+冷启动前提）**：每个任务/Phase 的 commit 完成后立即 push——远端 origin 是唯一跨机事实源，本地未推送的提交在换机视角等于不存在。
- 提交信息按仓库现行风格（中文、类型前缀、说清 why）；Phase 0 / Phase 1 / Phase 2 各自独立提交。
- **多角色 review**：已定案并升格为 Phase 0（§2），冷启动后第一个任务——方案见 §2，此处不重复。

## 6. 完成后处置

- 本 HANDOFF、讨论记录与 Phase 0 三份评审清单（`docs/yiyue31-translator-bilingual-phase0-role{1,2,3}-*.md`）为开发期文档：实施完成后按仓库惯例删除，要义写入提交信息，git 历史作存档（monorepo 根无常设 CHANGELOG，以 commit message 承载；**translator skill 自身的 CHANGELOG.md 不在此列**，按其惯例更新——见 T2.7）。
- **例外**：`docs/yiyue31-translator-bilingual-discussion-user-inputs.md` 为用户逐字存档（用户明确要求原状保存），**永久保留，不随清理删除**。
