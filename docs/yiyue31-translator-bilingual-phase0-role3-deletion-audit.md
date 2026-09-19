# Phase 0 角色③：删除面审计——遗漏清单

- 评审日期：2026-09-19
- 输入：HANDOFF §4/§1（docs/yiyue31-translator-bilingual-handoff.md）+ yiyue31-translator/（git 跟踪文件，`git ls-files` 44 个；`git grep` 只命中跟踪文件）

## 结论一行

§4 主删除面（Step 1.5 + doc_segmenter 整目录、Step 11 + consistency-checklist.js、路径表单文件化、README 脚本表）覆盖良好，但发现 **9 处遗漏**：最重的是 verify-results.json 反伪造链在单文件模式下静默断裂（M1）与 Step 12 散文对已删 Step 11 的三处悬挂引用（M2）——清单不完备，建议补进 T2.1–T2.7 后再实施。

## 遗漏清单

**M1** | scripts/verify-mechanical.js:234（连带 SKILL.md:139、scripts/verify-pipeline.js:21/213–235）| 命中 `translated-chunks`（verify-mechanical.js:18/230/234）| 类型：漏改 + 设计缺口（**高**）| 为什么 §4 没覆盖：T2.3 写"verify-mechanical.js 本身不改，调用改为整文件一次"，但其结果落盘函数 `appendResultLog`（L227–250）以 `path.basename(dir) !== "translated-chunks"` 为门（L234）——单文件工作流的译文在 `translation/` 根，**永不在** `translated-chunks/` 子目录下 → `verify-results.json` 永不产生（该旁路"任何异常静默跳过"是设计行为，不会报错）。连锁后果：① SKILL.md:139（Step 4.6——**不在** T2.3 的步骤枚举 4/4.5/5/6/7/9/10/11/12 内）"每次运行的结果自动追加落盘到 verify-results.json……供 Step 12 终检交叉核验"整句失实；② verify-pipeline.js 检查 7（L21 注释、L235）每次运行降为 WARN"无 verify-results.json 落盘记录"，CHANGELOG v2.5.0 明言此链为"杀'声称已跑'式伪证"的防线——瘦身后该防线**静默丢失**，且 T2.3 的 Step 12 保留清单（报告存在性/合规表/SKIPPED 披露/模板签名）不含"机械校验落盘"，没有任何条款处置这条链 | 建议：二选一并写入 T2.3——① 对"本身不改"开一行例外：L234 目录门放宽为 `translation/` 根亦落盘（一行改动，反伪造链保留）；② 明示弃用：删 SKILL.md:139 落盘句 + verify-pipeline.js 检查 7 一并移除，收窄事实记入 CHANGELOG v3.0.0。

**M2** | SKILL.md:226、228、233 | 关键词同源面（`consistency-checklist` 删除面；命中字面为 `consistency-{title}.md`/"一致性离群"/"Step 11"）| 类型：漏改（**高**）| 为什么 §4 没覆盖：T2.3 对 Step 12 只写了"verify-pipeline.js 适配单文件"，PM 手工验收散文不在任何条款。三处悬挂：L226"另查 `consistency-{title}.md` 有无致命术语冲突"（Step 11 删除后该文件永不产生）；L228 红旗来源"一致性离群"（= Step 11 清单的离群 chunk 产物）；L233 rework 路由"一致性→Step 11"（路由到已删除的步骤）| 建议：T2.3 增补"Step 12 散文适配"：删 consistency 查询句；红旗来源与 rework 路由去掉 Step 11 分支（一致性语义可并入 Step 5/6 或删除）。

**M3** | SKILL.md:226、228 | `chunk`（单数，非 `chunks` 字面命中）| 类型：漏改（中高）| 为什么 §4 没覆盖：同 M2——Step 12 条款只管脚本。Step 12② 抽样通读整段按 chunk 计数："读 N 个 chunk，N = max(2, ⌈总 chunk 数 × 10%⌉)""红旗 chunk / 最大 chunk""跨 chunk 连贯"、L226"注释密度 WARN 的 chunk"。单文件后无 chunk 可数，抽样规则悬空 | 建议：抽样单位改为全文/段落级表述（如"通读 ≥2 个章节 + 密度 WARN 触发段"），写进 T2.3。

**M4** | README.md:23–25（"### 文章分段"整节）| 命中 `doc_segmenter`（L25）| 类型：漏删/漏改（中）| 为什么 §4 没覆盖：T2.6 四项 = 工作流程行（L17）/设计决策档案/脚本表（L52）/依赖段——"文章分段"小节不在其中。该节整段描述 doc_segmenter 现行行为（"小文件直接作为单 chunk，大文件按章节切分"），且 L25"详见 `scripts/doc_segmenter/README.md`"在 T2.2 删目录后成**悬空指针**，属现行设计描述失实（非历史档案）| 建议：T2.6 增"删除'文章分段'小节"。

**M5** | README.md:57–61（依赖段）| —（名称不符 + 失实）| 类型：路径/内容不符（中）| 为什么 §4 没覆盖：T2.2"README 依赖段移除 bun"指向**不存在的行**——依赖段只有 Node.js v16+ / Python >= 3.10 / web-access，无 bun（bun 仅出现于 SKILL.md:41 随 Step 1.5 删除、CHANGELOG 历史与 doc_segmenter 内部）。真正失实的是 L60"Python >= 3.10"：Python→TypeScript 迁移（CHANGELOG:74/76）完成后全 skill 已无任何 Python 使用点，仅根 .gitignore 的 `__pycache__/` 忽略规则残存。实施时"移除 bun"会扑空且漏掉 Python | 建议：指令改为"依赖段删 Python >= 3.10（bun 本不在段内）"；可选顺带清根 .gitignore 的 `__pycache__/` 两行。

**M6** | references/evaluate-readability-prompt.md:13 | `chunk`（单数）| 类型：漏改（中低）| 为什么 §4 没覆盖：T2.1–T2.7 只字未提 references/ 四份评审 prompt。该行"1. **译文** — 待审的单个 chunk 中文译文"在 Step 9 全文单次化后失实（输入 = 整篇译文）| 建议：改为"待审的整篇中文译文"。注意：改前按仓库共享评审 prompt 同步纪律（CLAUDE.md）核查此文件有无需同步时间戳的兄弟拷贝。

**M7** | SKILL.md:12（功能描述）| —（"分段"非关键词字面）| 类型：漏改/失实（低）| 为什么 §4 没覆盖：T2.3 步骤枚举不含功能描述节，T2.7 只管 frontmatter description。"你统筹分段、分析、翻译、审阅和术语维护"中"分段"随 Step 1.5 删除失实 | 建议：删"分段、"二字。

**M8** | SKILL.md:63（Step 2 术语表理由句）| `chunk`（单数）| 类型：漏改（低）| 为什么 §4 没覆盖：Step 2 不在 T2.3 枚举内。"双选等于把裁决债务推给下游各 chunk 各翻各的"——chunk 语义随分块消失，理由短语失实 | 建议：改为"推给下游各自发挥"类表述。

**M9** | CHANGELOG.md（顶部，无 v3.0.0 条目）| — | 类型：漏改（低）| 为什么 §4 没覆盖：T2.7 bump 版本 2.5.0 → 3.0.0，但 T2.1–T2.7 无条款要求 CHANGELOG 记录破坏性变更；translator/CHANGELOG.md 逐版本连续记录（v2.3.x → v2.5.0）是现行惯例（注：HANDOFF §6"仓库无常设 CHANGELOG"指 docs/ 开发期文档处置，不适用于此文件）| 建议：T2.7 补"CHANGELOG 加 v3.0.0 条目（删多 chunk/doc_segmenter/Step 11、>40KB 路由、双语派生、verify-results 链处置结论）"。

> 待核验：无——以上每条均已对源文件行号与 §4 原文逐条复核。

## 已覆盖引用点记录

| 文件:行号/区块 | 命中关键词 | 覆盖条款 |
|---|---|---|
| SKILL.md:34（Step 1 预处理第 3 条，>40KB 确认）| chunk（单数）| T2.1（改提示+停止，置于建目录/落盘之前）|
| SKILL.md:38–46（Step 1.5 全节）| doc_segmenter ×2、chunks、manifest、progress.json | T2.2（删 Step 1.5）+ T2.2（删目录）|
| SKILL.md:44（指向 doc_segmenter/README.md）| doc_segmenter | T2.2（随节删）|
| SKILL.md:48–54（路径表 + manifest 遍历）| progress.json、chunks、manifest、translated-chunks | T2.3 路径表单文件化 |
| SKILL.md:88、120（Step 4/4.5 每 chunk subagent）| chunk（单数）| T2.3（全文单次）|
| SKILL.md:133–136（Step 4.6 调用块，manifest 取名 + per-chunk 调用）| manifest、chunks、translated-chunks | T2.3 verify-mechanical"调用改为整文件一次"条款（注：仅 L139 落盘声明句例外，见 M1）|
| SKILL.md:150、154–156、173（审校循环 + Step 9，报告路径 `review-{type}-chunk-{NN}.md`）| chunk（单数）| T2.3 Step 5/6/7/9 + 路径表命名 `review-{type}.md`（落点共 4 处：L154/155/156/L173，意图已覆盖，供实施核对）|
| SKILL.md:177、199（Step 10 合并/拼接 chunk）| translated-chunks、chunk | T2.3 Step 10 简化（合并步骤消失）|
| SKILL.md:203–214（Step 11 全节）| consistency-checklist、chunks、translated-chunks | T2.3 Step 11 整体删除 |
| SKILL.md:222–224（verify-pipeline 调用）| — | T2.3 Step 12 脚本适配（散文除外，见 M2/M3）|
| README.md:17（工作流程行，含"10. 合并 → 11. 全局一致性"）| — | T2.6 工作流程行 |
| README.md:41（设计决策"全局一致性不读整篇"）| — | T2.6 明示删除（"等分块条目"——逐条核对档案其余 9 条均为注释体系/审校纪律类，无其他分块条目）|
| README.md:52、54（脚本表两行）| doc_segmenter、consistency-checklist | T2.6 脚本表（−doc_segmenter、−consistency-checklist、+derive-bilingual）|
| README.md:57–61（依赖段）| — | T2.6 依赖段（但 T2.2 的具体指令与内容错位，见 M5）|
| CHANGELOG.md:12/13/24/25/42/59/74/84/92–96（全部命中）| doc_segmenter、progress.json、consistency-checklist、chunk | 历史性记载（均带日期版本节，v2.3.x–v2.5.0），按仓库惯例保留，瘦身后不失实（新条目缺失见 M9）|
| scripts/verify-pipeline.js 全部 28 处命中 | chunks ×24 行、progress.json ×2 行、translated-chunks ×2 行 | T2.3"verify-pipeline.js 适配单文件"整体覆盖 |
| scripts/verify-mechanical.js:18/230/234 | translated-chunks ×3 行 | T2.3"本身不改"明示保留——但其后果即 M1 |
| scripts/consistency-checklist.js 全部内部命中 | chunks ×11 行、consistency-checklist ×5 行 | 随 T2.3 整文件删除 |
| scripts/doc_segmenter/**（src 15 文件 + tests 12 文件 + README/package.json/tsconfig/.gitignore）| 全部关键词的绝大部分命中 | 随 T2.2 整目录删除 |
| references/ 其余 3 份 evaluate prompt、scripts/word-counter.js、根 .gitignore | 零命中 | 无需改动 |

## 关键词命中全景

| 关键词 | 命中文件数 | 命中行数 | 备注 |
|---|---|---|---|
| `doc_segmenter` | 4 | 10 | CHANGELOG 4、README 2、SKILL 2、doc_segmenter/README 2 |
| `chunks` | 23 | 264 | 其中 10 行同时含 `translated-chunks`（按行归并，不重复计）|
| `manifest` | 6 | 18 | SKILL 3、doc_segmenter 内部 15 |
| `progress.json` | 7 | 26 | 存活文件命中仅 SKILL 2 + verify-pipeline 2，其余在删除目录/CHANGELOG |
| `consistency-checklist` | 4 | 10 | CHANGELOG 3、README 1、SKILL 1、脚本自身 5 |
| `translated-chunks` | 3 | 10 | SKILL 5、verify-mechanical 3、verify-pipeline 2（已计入 `chunks` 行数）|

删除面之外补充命中（单数 `chunk` 等非字面关键词，已并入上表各 M 项）：SKILL.md 12/34/63/88/120/133/150/154–156/173/199/205/213/226/228；README.md 17/25/52；references/evaluate-readability-prompt.md 13；CHANGELOG 历史行若干。

## 补充备注（非遗漏，实施注意 + 反向核对）

- **反向核对（§4 所写 vs 实际存在）**：`scripts/doc_segmenter/` ✓（含自带 tests ✓、README/package.json/tsconfig ✓）；`scripts/consistency-checklist.js` ✓；SKILL.md Step 1.5 ✓、Step 11 ✓、版本 2.5.0 ✓（frontmatter L4）；`scripts/verify-pipeline.js` ✓。唯一名称/位置不符 = T2.2"README 依赖段移除 bun"（见 M5）。
- **T2.2"含 node_modules"**：磁盘确有 `node_modules/`（4KB，被 doc_segmenter/.gitignore 忽略）与 Windows 路径误建产物 `scripts/doc_segmenter/D:/tmp/`（空目录树）。目录删除必须用 `rm -rf`（`git rm` 不碰未跟踪内容），二者随之消失，无需单独处理。
- **T2.3 保留清单的收窄副作用**：verify-pipeline.js 现有七类检查（头部注释 L11–21），保留清单只列四项。其中"时序一致性""尺寸下限"在单文件下仍有判定对象（报告 vs 整篇译文），若"保留反伪造骨架"被机械读成"只留这四项"会白白丢弃——实施时逐项明示去留。
- **未跟踪文件参考**（不计删除面）：`references/terms.md`（根 .gitignore L12 忽略，运行态）、`scripts/doc_segmenter/node_modules/`、`scripts/doc_segmenter/D:/`（后两者随目录删除消失）。
