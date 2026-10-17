# 测试套件（scripts/test/）

xl-translator 脚本层的统一测试目录，与源码分离（源码在 `scripts/<模块>.mjs` 与 `scripts/segment/`），随 git 管理。

## 目录结构

```
scripts/test/
├── run.sh                          # 统一入口：逐文件严格串行跑全部测试
├── README.md                       # 本文件
├── unit/                           # 单元层：程序化合成夹具（确定性，不落盘），钉死算法行为
│   ├── segment.test.mjs            #   分段算法：fence 感知/拼接 sha/落带/R11-B/产物/CLI
│   ├── status.test.mjs             #   状态机（M1b+S2③④⑤⑦+S3③④+S3①②⑤守卫+S3b riders）：推导/双段契约/统一物化/stale/动词/计数器/预算/CLI/冻结窗硬门/fixer 闭环/双计数器/events 原子写/撕裂容错/suspend 同事务/mtime 对账/派发 >90 WARN/冷启动卡/人话同源/RAM·水位·symlink 守卫/合并追加·目录 fsync·session-end 生产者/A2 守卫 env 解析/E2 free locale/A3 守卫注行/A4 resume 消解/E3+Q3 fsync 容错无泄漏
│   ├── import-draft.test.mjs       #   draft 导入（S2⑥+S3b）：版本戳拒旧格式/§7 边界执行/events 归档新建禁补记/幂等/探针小文档全流程/ARCH-A 重入收敛（①③④+②机械枚举 k=1..N）/ENG-3 失败码传播
│   ├── verify-mech.test.mjs        #   机械校验：原五+新四硬判、fork 源对照、CLI 冒烟
│   ├── merge.test.mjs              #   合并（M1c）：M1-M7 纯函数与病态输入、CLI 冒烟
│   ├── derive-bilingual.test.mjs   #   双语派生（Phase 1）：B1-B8 纯函数与病态输入、CLI 冒烟
│   ├── probe.test.mjs              #   探针生成（M1c+S2⑦）：四维覆盖/虚拟 NN/确定性/truth 落盘与防覆盖/--run 新轮命名/伪报告命中正反
│   ├── final-gate.test.mjs         #   交付门（M1c+前置①③）：重执行/完备性/G3/R23/标题锚/G4/R15/探针/元信息头/R8-c
│   ├── handoff.test.mjs            #   交接包机器件（M3 前置④+S3b）：glossary 解析/单复数归一/词边界投影/语境段/幂等/风格卡投影 BOM（SP3/E4）
│   ├── consistency.test.mjs        #   统稿清单（M3 前置②）：fork 三项继承 + 标题锚对/间距/接缝/文风拼料
│   ├── word-counter.test.mjs       #   字数统计（M3 前置②）：bytes 判据/中英分项/CLI --json
│   └── sizes.test.mjs              #   三档尺寸断言（S2+S3b 守卫 env 钉死）：SKILL.md ≤20KB 硬上限 / references ≤6KB/件 / fixer·审校单元包 ≤40KB（夹具实测口径）
└── regression/                     # 回归层：git 管理的真实文档夹具，钉死真实世界回归
    ├── segment.regression.test.mjs
    ├── merge.regression.test.mjs   #   M1c：真实译文快照 × 合成场景装置（M1-M7）
    └── fixtures/
        ├── single/  single-NN.md   # 无需切割（总长 ≤ max，单 chunk 是正确形态）
        ├── few/     few-NN.md      # 切成 2-10 个 chunk
        ├── many/    many-NN.md     # 切成 ≥11 个 chunk
        └── merge/                 # 行为场景型（M1c）：happy/partial/residue/broken/case-NN 工作目录快照
```

## 怎么跑

```bash
bash scripts/test/run.sh                    # 全部（推荐，逐文件串行）
node --test scripts/test/unit/segment.test.mjs          # 单跑一个文件
node --test scripts/test/regression/segment.regression.test.mjs
```

**串行纪律**：不用 `node --test <目录>`（多文件并行起进程，1.87GB 内存机器 OOM 风险）；单文件内部 node:test 默认串行，一次一个文件即全程串行。

## 两层分工

| | unit/ | regression/ |
|---|---|---|
| 夹具 | 程序化合成，跑时生成进临时目录 | **真实文档，git 版本化**（换真料不换标准） |
| 钉什么 | 算法行为（边界条件、病态输入、关卡退出码） | 真实世界回归（真实标题结构/围栏/表格） |
| 为什么 | 合成样例可精确构造病灶 | 旧 doc_segmenter 的事故（64KB→56 碎片、围栏内 `#` 误判标题）只发生在真实文档上 |

## 回归夹具契约（可替换 / 可增补，评估标准不变）

- **命名**：`<类>-<NN>.md`，NN 两位连续编号；测试按目录自动发现，**新增文档零改码**。
- **替换**：同名覆盖即替换（文件名固定，方便后续换新料）；替换后必须仍满足所在类的角色判据，否则测试 FAIL 提示放错类。
- **增补**：往对应类别目录加 `<类>-<NN>.md` 即被自动纳入。
- **来源**：全部为真实单篇文档（不拼接、不改写内容），当前取样：

| 夹具 | 来源 | 大小 | 角色 |
|---|---|---|---|
| single-01.md | 6-months-to-live-for-open-models | 10.7KB | 单 chunk |
| single-02.md | compaction-in-pi | 7.3KB | 单 chunk |
| few-01.md | **AI-Native-SDLC-playbook（53 碎片事故原文，Yiyue 指定反例）** | 64KB | 5 chunk（旧方案同文 56 碎片） |
| few-02.md | abc-legal-builder-agents | 16.1KB | 2 chunk（刚过 max 的边界例） |
| many-01.md | harness-v2 | 233.5KB | 23 chunk（含 1 个结构性不可合并尾块） |

## 固定评估标准（S1-S8，结构性判据，与具体文档无关）

回归层对每篇夹具套用同一套标准——**换文档、加文档，标准不变**：

| # | 判据 | 防什么 |
|---|---|---|
| S1 | 关卡退出码 = 0（含拼接 sha === 原文 sha 硬关卡） | 任何路径静默失败 |
| S2 | 测试独立复读全部 chunk 按 NN 序拼接，字节级 === 归一化原文 | 偷删/改写分母（只信 run 内部关卡 = 既当运动员又当裁判） |
| S3 | 命名全部匹配 `chunk-<NN>[X]-<slug>.md`，NN 从 01 连续无跳号 | 命名漂移破坏 status/final-gate 的 glob 分辨规则 |
| S4 | 磁盘 chunk 数 === manifest 表登记；manifest 落盘存在；progress.json 不再写出（status.md 吸收，2026-08-31） | 产物间不一致 |
| S5 | 非原子 chunk ≤ max（15KB）；原子 X 免（超限即其形态，R11-B） | 散文超限（审校半块甜点区被破坏） |
| S6 | 非原子 chunk ≥ min（8KB）；唯一豁免 = 末 chunk 且并入前包超 max（结构性不可合并） | **碎片病**（旧方案 66 字节 chunk 的直接死因） |
| S7 | 数量角色：single = 1；few ∈ [2,10]；many ≥ 11 | 类别判据 + 粗粒度总量回归 |
| S8 | chunk 数 ≤ ⌈总字节 / min⌉ | 整体碎片化回归（数量上界兜底） |

S6/S8 的豁免与上界都是**结构性**的（由贪心装包 + 尾块回收的算法性质决定），不是对某篇文档调出来的魔法数——所以标准可以固定不变。

## 行为场景类回归契约（merge 型，M1c 落地）

**契约先行登记（2026-08-31 Yiyue 裁决），测试本体随 `merge.mjs` 交付落地——不为不存在的脚本写死代码。**

与切割层两点适配：

1. **类别按输入形态（行为场景），不按尺寸**——合并的正确性取决于输入集合的形态，不是文档大小；
2. **夹具 = 真实译文 + 合成脚手架**——译文文本用真实中文（refined-stock 既有译文，含真实围栏/表格/术语形态）；场景装置（verify-results.json 等筛选依据）天然只能合成——它就是被测对象。

```
regression/fixtures/merge/
├── happy/case-NN/      ← 全 passed 快照 → 正常合并
├── partial/case-NN/    ← 部分 stale/未过审 → 只收 passed
├── residue/case-NN/    ← «» 残留 → 必须拒绝
└── broken/case-NN/     ← 缺 chunk/乱序/sha 不符 → 非零退出报错
```

每个 case 是一个微型工作目录快照（`translated-chunks/` + `manifest.md` + `verify-results.json` 等），目录自动发现，加 case 零改码——与切割夹具同契约。

**固定评估标准 M1-M7**（结构性判据，换 case 不变）：

| # | 判据 | 防什么 |
|---|---|---|
| M1 | merged 字节 === passed chunk 按 NN **数值序**拼接（禁字典序，R29） | 顺序错乱 |
| M2 | 收录集合恰好 = 最新 verify passed（多一少一都 FAIL） | 带病混入 / 漏收 |
| M3 | «» 残留 = 0，且清标动作有记录 | 临时标记漏进交付物 |
| M4 | 产物名不命中 deliverable 模式 | R12 半泄漏 |
| M5 | 同输入重跑字节相同（无时间戳 / 无随机） | 不可复现 |
| M6 | 输入损坏（缺 chunk/乱序号/sha 不符）→ 非零退出 + 可操作报错，绝不静默拼残稿 | 静默残稿（最恶） |
| M7 | 合并零改写：无 BOM / 无 EOL 改写 / 无 `"\n\n"` 插入（旧 doc_segmenter 同款拼接病） | 组装即篡改 |

## 派生视图判据（derive-bilingual 型，Phase 1 落地）

**契约先行登记（HANDOFF §3），测试本体随 `derive-bilingual.mjs` 交付。**

被测对象 = PASS 后的只读派生视图（交付物 × 原文机械交错），非管线产物、非交付物——判据围绕
“只读、精确、宁降级不误导、幂等”四性。固定判据 **B1-B8**（结构性判据，换 workdir 不变）：

| # | 判据 | 防什么 |
|---|---|---|
| B1 | 只读纪律：唯一产物 `translated-<title>-bilingual.md`，绝不写交付物/原文/chunks/译文 | 派生反噬管线 |
| B2 | chunk 配对精确：manifest NN 连续 + manifest sha × chunks/ 实文件 + translated 存在性；配对失败非零退出 | 静默错配交错（比不交错更害读者） |
| B3 | 交付物 sha ≠ REPORT 锚（疑手改）→ 照跑 + WARN 一行（派生只读不覆盖交付物） | 派生路径误触手修询问 |
| B4 | fence 感知节切分：锚开优先锚行配对（`*English*` 剥星号逐字 === 原文标题，一对一）；锚关或任一锚行缺失 → 整 chunk 回退标题顺序配对；标题数不等 → 整 chunk 降级对照 | 围栏内 `#` 误判；错序交错 |
| B5 | 节内块按序配对（protectedRanges 整块 + 空行分段）；块级指纹 = 代码块逐字相等 + isCode 一致；节级指纹 = URL 集合相等；不符 → 该节降级节级对照 | 按序错配的交错（宁降级不误导） |
| B6 | 交错格式：元信息头仅文件头一次（交付物头部照抄至首个 `---` + 引用块内追加双语版行）；锚行原样保留（锚关时插英文标题行——英文标题信息恰好一次）；只交错不改动任何块内容 | 交错即篡改 |
| B7 | 幂等：同输入重跑字节相同（无时间戳无随机；头部源交付物 sha 是确定性字段） | 不可复现 |
| B8 | 降级清单随输出可见：文件尾注释 + stdout + 对齐覆盖率 | 静默降级 |

## 终检判据契约（final-gate 重执行清单——S2① 自 SKILL.md Step 10 迁入）

SKILL.md Step 10 只保留指针与运行时纪律（半径分级/PENDING-USER/固定顺序）；**判据清单的权威登记在此**——改判据 = 改 `final-gate.mjs` + 本表 + 对应用例，三处同步。

| # | 判据 | 防什么 | 钉死用例（unit/final-gate.test.mjs） |
|---|------|--------|--------------------------------------|
| F1 | 机械校验全项重跑（verify 同参；R8-c 投影从 glossary × 原文重推导，不信任落盘投影） | 删投影灭判 / 流水造假 | "重执行：篡改译文数字…"/"R8-c 零信任" |
| F2 | merged 重导出 diff（assemble 纯函数；归因：chunk 可归因→scoped，全净→global） | merge 后偷改 | "重执行：篡改 merged 本体" |
| F3 | 拼接 sha 复核（chunks/ 按 NN 数值序 === 原文；manifest 钉死） | 偷删/改写分母 | "重执行：篡改分母" |
| F4 | 完备性矩阵：4 维 × **逐节** sha（首审报告 `sec:` 表命中 或 delta 单节报告头 sha 命中；**未变节豁免不级联**；准确性缺失 = 无条件 FAIL） | 报告缺/旧不送审就交付 | "完备性"两用例 + S2① 节级豁免用例 |
| F5 | 报告签名扫描：undersize（阈值 = 240B × unitKB/4，下限 120B——按**整 chunk/节/探针**单元缩放）+ 跨报告同内容模板签名 | 批量盖章 | "签名：undersize…模板签名" |
| F6 | G3 括注对账（译文括注集合 === 台账保留 ∪ R23 必兑现，双向相等；空集对非空台账 FAIL） | 未裁定括注/空洞合规 | "G3" 用例 |
| F7 | R23 精选表兑现（右值（左值）紧邻括注形态；无文件 = 无输入不报错） | 金句不兑现 | "R23" 用例 |
| F8 | 标题双语锚硬判（fence 感知分母；中文行 + 次行锚逐字 + 级别序列；brief 关闭随披露跳过） | 锚漂移/删锚 | "标题锚" 两用例 |
| F9 | G4 冷读覆盖矩阵（逐 chunk sha）+ pm-review 选样集重推导（每 5 抽 1 + 升级/接缝必抽；五维无 SKIPPED） | 挑软柿子/冷读缩水 | "G4" 用例 |
| F10 | R15 pm-review 头部 merged-sha 锚不豁免 | 旧稿结论携入 | "R15" 用例 |
| F11 | 探针命中（truth 比对源侧；每维度每 run ≥1；缺报告/未命中 = FAIL） | 审校有效性无证据 | "探针" 用例 |
| F12 | 报告头三行机器解析（`sha:/model:/time:`(+`sec:` 表)——status.mjs `parseReportHead` 同源） | 头部契约漂移 | status 用例（S2② 头三行解析） |
| F13 | C4 抽核（S2②）：dispatch 事件 `detail` 携带的 c4 口径 × 当前报告 sha 表一致（或被更晚同单元派发/invalidate 取代）；随机抽 ≥3、`--seed N` 同 seed 同抽样；结果落 events detail | 口径漂移/偷换单元/报告未 certify 所派发内容 | final-gate 用例（S2② C4 抽核） |

## 尺寸三档判据（sizes，S2 落地；口径 = 十进制 KB=1000B）

| 档 | 判据 | 防什么 |
|---|---|---|
| 1 | SKILL.md ≤ 20,000B 硬上限（批末交付态口径；16,000B 软目标仅 WARN） | SKILL.md 无界回胖（③v4-3） |
| 2 | references/*.md 单件 ≤ 6,000B（glob 全量，新增件自动纳入） | 懒加载预算失守 |
| 3 | fixer 包（--verb fix 实测物化）与审校单元包（staging 单元 + chunk 原文 + 附件预算 3,800B = 风格卡投影 ≤2,000[S3 已落地] + handoff 投影 ~1,400 + brief ~400）各 ≤ 40,000B | 单元包超上下文预算（③v4-5；超限出口=首审切半/分维派发） |

## 风格卡投影判据（S3 §3 注落地）

**判据权威登记于此**——改判据 = 改 `handoff.mjs`（`renderStyleProjection` 纯函数 + runHandoff 第三机器件）+ 本表 + 对应用例，三处同步。消费口径：审校单元包附件自此用本投影（≤2KB），**卡全文仅进主上下文**（§5 红线：卡 7,036B 全文进每包属超红线）。

| # | 判据 | 防什么 | 钉死用例 |
|---|------|--------|----------|
| SP1 | 确定性蒸馏 ≤2,000B：全标题逐字保留（原顺序）+ 每节首条内容行（列表前缀原样、>80 字符截断加 …）+ 超预算自最后一个节起逐节弃内容行（标题保留）直至达标 + 尾行截断披露（`源卡 N B → 投影 M B`，未截断也附同款——披露口径统一）+ 源卡 sha 锚；同输入重跑字节相同（幂等，无时间戳）；产物恒 ≤ budget 字节 | 卡全文进审校包超 §5 红线 / 投影不可复现 | unit/handoff.test.mjs "SP1…"（含收紧预算驱动弃内容路径）；unit/sizes.test.mjs 档 3b（>6KB 合成卡 → renderStyleProjection 实测 ≤2,000B、全标题与 sha 在场、ATTACH = 投影实测 +1,400+400 ≤3,800） |
| SP2 | handoff.mjs 第三机器件：工作目录有 style-card.md → `handoff/style-card-proj.md` 落盘（入 generated 与 --json 结果，附字节数），既有 projection/context 两件不回归；缺卡 → warns 提示且不阻断（exit 0）、投影不落盘 | 缺卡硬失败阻断交接 / 第三件与既有件相互回归 | unit/handoff.test.mjs "SP2…" |

## 冻结窗判据（S2③ 落地）

**判据权威登记于此**——改判据 = 改 `status.mjs`（`FREEZE_STAGES`/`FREEZE_ROUND_MAX` 常量区、冻结窗队列/派发/计数派生）+ 本表 + 对应用例，三处同步。G2 rider 口径：本表是**两批既有用例的判据契约补登记**（非新用例）。

| # | 判据 | 防什么 | 钉死用例（unit/status.test.mjs） |
|---|------|--------|----------------------------------|
| FR1 | 冻结窗开启 = 统稿完成后（`FREEZE_STAGES` 一处可调：cold-read/pm-review/final-gate） | 窗口起点散落各处漂移（统稿前误冻结漏修 / 窗晚开漏计数） | （由「S2③ 冻结窗复欠队列…」前置断言隐式覆盖：统稿完成 → global=cold-read 且人话段披露冻结窗；常量本身无具名用例） |
| FR2 | 补审轮派发批口径：冻结窗内一次补审派发批 = 一轮 freeze-round 事件；计数器事实源 = 事件流派生（freezeRounds） | 轮次凭会话记忆/渲染口径计数（重启丢轮或重复计） | 「S2③ 冻结窗复欠队列…」（批落 1 条 freeze-round）；「GR3 ENG-1 dispatchEventsBatch 纯函数…」「GR3 ENG-1 集成…」（同批原子落流） |
| FR3 | 项目级 ≤2 硬门：超限 dispatch exit 3 + pending.md 上报 + 不物化 + 不追加派发事件（suspend 事件落流） | 冻结窗补审无限膨胀（点名修复变相重译） | 「S2③ 冻结窗补审轮 >2 硬门：第 3 轮 dispatch → 非零退出 + pending.md 上报 + 不物化」 |
| FR4 | 双计数器不挤占：freezeRounds（项目级）与 reviewRounds（per-chunk 修复环轮）分开派生；修复环每 chunk ≤3 超限停 chunk 登 residue、项目不停 | 两轮互占额度（冻结窗轮耗尽阻断正常修复 / 修复轮虚增冻结窗轮） | 「S2③ 双计数器不挤占：冻结窗轮已耗 2 不影响 per-chunk 阶段派发；fix/freeze-round 分开派生」＋「S2④ 修复环轮每 chunk ≤3…」（residue 停修半段） |
| FR5 | 窗内修复优先级：变化节 × 4 维补审队列优先于全局动作（pm-review 等），复欠清零才回全局 | 点名修复的复欠被全局动作插队（欠账沉到终检才爆） | 「S2③ 冻结窗复欠队列…」（action 空〔S3b Q1 补字面断言 `queue.action === null`〕、队列 = s2×4 维；复欠清零回 pm-review） |

## fixer 闭环判据（S2④ 落地）

**判据权威登记于此**——改判据 = 改 `status.mjs`（`fixDispatch`/`renderFixerPkg`）+ 本表 + 对应用例，三处同步。G2 rider 口径同上：既有用例的判据契约补登记（非新用例）。

| # | 判据 | 防什么 | 钉死用例 |
|---|------|--------|----------|
| FX1 | `--verb fix` 物化 fixer 包 `staging/fixer-chunk-NN.md` = 定位块（sec 表，c4 同构）+ 译文全文 + FAIL 报告全文（主上下文不进报告）；`--dims` 选维；fix 事件计轮 | 主上下文被报告全文撑爆 / 修复无定位无依据 | 「S2④ fixer 包物化：报告全文+译文+定位块进包；--dims 选维；fix 事件计轮；入参校验」（unit/status.test.mjs） |
| FX2 | 全链路 FAIL → fixer → verify 真跑 → 复欠 = 变化节 × 4 维 → done（事件流 fix/verify-pass/dispatch 各环节在场） | 机制各自为绿、链路断点（修了没验、验了没复欠） | 「S2④ 全链路：FAIL→fixer→verify→复欠（事件流各环节在场；verify 事件由 verify-mech CLI 落流）」 |
| FX3 | 修复环轮每 chunk ≤3：超限停该 chunk + 登记 residue-chunk-NN.md + residue 事件、项目不停（无 pending.md；已停修 chunk 拒再派修复） | 无限修复循环 / 单 chunk 拖死整个项目 | 「S2④ 修复环轮每 chunk ≤3：第 4 次物化被拒 → 停该 chunk + residue 登记，项目不停」 |
| FX4 | 包尺寸 ≤40,000B（sizes 档 3a：max 尺寸译文 + 四维报告全文实测物化）；fixer 按真 chunk 派发（`--nn` 须在 manifest——探针虚拟 NN 进不了 fixer）、chunk 原文不占包 | 包超上下文预算 / 探针混入修复流 | 「档 3a：fixer 包 ≤ 40,000B（max 尺寸译文 + 四维报告全文，--verb fix 实测物化）」（unit/sizes.test.mjs）；"探针不进 fixer"由「S2④ fixer 包物化…」入参校验断言覆盖（nn 不在 manifest exit 1；S3b Q4 补真实探针 NN 901 字面断言——原以 nn=99 替身） |

## 事件流事务判据（events/pending 同事务，S2⑤ 落地）

**判据权威登记于此**——改判据 = 改 `status.mjs`（events 收口/对账）或 `final-gate.mjs`（suspend 调用点）+ 本表 + 对应用例，三处同步。防造假红线：事件流**禁补记**——原子写只改写入机制不补历史；对账只检测不回填（无载荷历史 suspend 只 WARN 不重建）。

| # | 判据 | 防什么 | 钉死用例（unit/status.test.mjs） |
|---|------|--------|----------------------------------|
| E1 | events 原子写：追加 = 旧全文+新行 → tmp+fsync+rename 一次性替换；任一中断时刻文件均为完整行集合；遗留 `.tmp` 下次写入覆盖清理 | 中断撕裂行（③v3健3；①7 断档） | "appendEvents 原子写…" |
| E2 | 撕裂尾行容错：读侧不可解析行 WARN+忽略（尾行=撕裂遗留 / 中段=疑似外部改写），完整行照常解析、不阻塞；追加侧遇撕裂尾补换行隔离，不改写历史字节、不吞并新行 | 历史撕裂死锁 / 撕裂行吞并新行（①7） | "撕裂尾行容错…"、"撕裂尾行追加隔离…" |
| E3 | suspend/pending 同事务：suspend 事件（携 pending.md 全文载荷）先原子提交 → pending.md 原子物化；中断半态（事件在、pending 缺）由 `scanWorkdir` 对账自愈重建；**suspend 后 pending.md 必在** | suspend 不落 pending（①6） | "suspendTxn 同事务…"、"同事务自愈…" |
| E4 | 同事务反例：提交点故障注入（rename 恒败）→ 事件与 pending 均不在，不留半套状态；无载荷历史 suspend 只 WARN 不重建 | 半套状态 / 凭空伪造重建 | "同事务反例…"、"历史无载荷 suspend…" |
| E5 | §9 mtime 对账兜底：脚本同进程成对产物（merged-draft / verify-results / staging / 交付物 / 双语版）mtime > events 末事件时间戳 → WARN（人话 + `--json` state.warnings 同源）；只 WARN 不阻塞；对齐后不 WARN | 有活动未落流的断档（①7；§9 REPORT 声明基准兜底） | "§9 mtime 对账…" |

E5 审计集口径：agent 步调产物（reviews/adjudications/translated-chunks/chunks/manifest——事件配对跨步延迟，中间态晚于末事件属正常）与按设计晚于事件的视图/旗标件（status.md/pending.md/REPORT.md）不入集，防常态误报；末事件时间戳取实读文件尾（本次 run 已追加事件计入，防自误报），1s 容差吸收文件系统时间戳粒度。

## draft-import 判据（S2⑥ 最小实现）

**判据权威登记于此**——改判据 = 改 `import-draft.mjs` + 本表 + 对应用例，三处同步。边界清单权威 = 提案 §7（受/拒/隔离/重建逐产物；缺省 = 未列产物默认隔离 WARN 不导入）；真实目录迁移（P1 实跑）不属 S2⑥——本批只交付机制+用例。防造假红线：events **禁补记**——旧流整体归档不迁移，新流自零新建（首事件 = `import`）。

| # | 判据 | 防什么 | 钉死用例（unit/import-draft.test.mjs） |
|---|------|--------|----------------------------------|
| D1 | 版本戳：status.md 头 `schema:` 行（`SCHEMA_VERSION` 与 renderStatus/parseStatusSchema 同源）；导入源 status.md 无戳（旧格式）或版本不识 → **非零拒收且零副作用** | 旧状态混入（"delivered" 系误报——§7 status.md 行；跨版本迁移属 S4①） | "D1 旧格式 status.md…"、"D1 version 在场…" |
| D2 | §7 边界数据驱动执行（`classifyEntry` 首匹配）：受类原样保留；拒类 sibling 归档 `-r1`（reviews→reviews-r1/、events.jsonl→events-r1.jsonl、verify-results→-r1.json）；隔离类 + 未列缺省入 `quarantine/`（缺省附 WARN）；staging 清空 | 半块锚/混存证据伪装可迁移（§7 拒类理由）；来历不明件静默混入 | "D2-D4 边界执行…" |
| D3 | events 禁补记：旧流归档逐字节保留不迁移；新流自零新建（首事件 = import，携对账明细）；幂等重入（首事件=import → 跳过移动不追加） | 凭空续写历史事件（防造假红线）；重复导入重复归档 | "D2-D4…"、"D3 幂等…" |
| D4 | verify-results 强制重跑：归档 ⇒ 全部 chunk 推回 verify 阶段（status 派发口径强制重跑） | 混存 verify 结果被继承（§7：混存不可信，重跑 S4④ 分档前口径） | "D2-D4 边界执行…"（stage=verify 断言） |
| D5 | 探针小文档全流程：导入 → status 可派发 → verify 重跑 → dispatch（真+探针同构物化）→ 伪审校报告落位 → truth 命中（正反）→ 状态机推进至 **ready-merge**（覆盖深度止于此；merge 后归既有 merge/final-gate 用例域） | 机制各自为绿、链路断点 | "D5 探针小文档全流程…" |

## probe 新 run+truth 判据（S2⑦ 落地）

**判据权威登记于此**——改判据 = 改 `probe.mjs`/`status.mjs` + 本表 + 对应用例，三处同步。§7 probe truth 行：旧 run 的 truth 拒（新 run+truth，`--run <name>` 命名）。

| # | 判据 | 防什么 | 钉死用例 |
|---|------|--------|----------|
| P1 | `--run <name>` 新审校轮新 run 命名（soai-r2 形态）：truth 落 `<name>.json` 四维齐、虚拟 NN 段不变、同 run 重跑拒绝（防覆盖）、同 run 跨目录生成字节相同（缺省 seed = runId 哈希） | 新轮混用/改写旧 run 的 ground truth | unit/probe.test.mjs "S2⑦ --run soai-r2…" |
| P2 | `--probe-truth` 伪报告命中：报告含 expectedHit → `probeCheck` 零 FAIL；缺报告 = 直接 FAIL；未含 expectedHit → 未命中 FAIL 并披露期望串（注入已知缺陷被 truth 抓到；链路级正反另见 D5） | 审校有效性无证据 / 漏抓伪装通过（R20/F11） | unit/probe.test.mjs "S2⑦ --probe-truth 伪报告命中…" |
| P3 | status 派发计数 >90 → WARN（§12 重评线观测点）：口径 = events 总 dispatch（`deriveCounters.dispatchTotal`，与现有派发计数同源，含探针）；91 → WARN 在场（人话 ⚠ 行 + `--json` state.warnings 同源、不阻塞）；90 → 不 WARN | 迁移+重审成本逼近重头译而无观测点（③v4-7/§12；只观测不代决） | unit/status.test.mjs "S2⑦ 派发计数 >90 WARN…" |

## 冷启动卡判据（S3③ 落地）

**判据权威登记于此**——改判据 = 改 `status.mjs`（`renderColdStart` + run() dispatch 收尾再生点）+ 本表 + 对应用例，三处同步。冷启动卡 = `handoff/cold-start.md` 机器生成的交接卡（**物化视图，可删可重建**；重跑覆盖）：`--verb dispatch` 收尾时与 status.md 同源再生（无论本轮是否实际物化），供新会话零记忆冷启动；守卫出口的再生点随守卫批次接入。

| # | 判据 | 防什么 | 钉死用例（unit/status.test.mjs） |
|---|------|--------|----------------------------------|
| CS1 | dispatch 自动再生：`--verb dispatch` 收尾写 `handoff/cold-start.md`（目录缺则 mkdir -p）；头部含机器生成披露、再生时间、产物指纹（`fingerprint(inv)`——与 status.md 同源）、数据源披露；欠账表逐 chunk 行（nn 两位/stageCn 中文/stale 节 id 逗号串或 `-`）**直接派生自 state.chunks**（--json 输出的同一对象，不重扫文件系统）；下次动作行 = 人话下次口令同源（继续翻译 \<title\>） | 冷启动卡与状态机双源漂移（会话记忆依赖回潮；第二事实源） | "CS1 冷启动卡自动再生…" |
| CS2 | 视图新鲜：两次 dispatch 间状态变化（补齐 delta 报告清欠）→ 再生的欠账表反映新状态（整体重写覆盖，非增量追加）；本轮无可物化单元也再生 | 陈旧视图误导续跑（读到已清欠账重复派发） | "CS2 冷启动卡视图新鲜…" |

## 人话同源判据（S3④ 落地）

**判据权威登记于此**——改判据 = 改 `status.mjs`（`plainLines`/`viewStats`/`plainSelfCheck`/`secFresh`/`suspendUnresolved`）或 `final-gate.mjs`（secFresh import 消费）+ 本表 + 对应用例，三处同步。

| # | 判据 | 防什么 | 钉死用例（unit/status.test.mjs） |
|---|------|--------|----------------------------------|
| PL1 | plainLines 单一来源：人话段行构造整体提取为导出函数（统计量收口 `viewStats`），renderStatus 消费同函数——**输出字节不变**（重构非改文案） | 双份人话构造漂移（status.md 与冷启动卡/守卫各说各话） | "PL1 plainLines 与 renderStatus 同源…" |
| PL2 | 自一致性断言：`plainSelfCheck(lines, state)` 从 state（--json 同一对象）重推关键事实（done/total 进度分数、当前 chunk nn 与 stageCn、冻结窗轮次 freezeRounds/FREEZE_ROUND_MAX（行在场时）、residue 行、⚠ 行数 = warnings 条数）对 lines 断言——健康空失配、篡改报失配、失配 push 进 state.warnings（"人话自检失配：…"前缀，人话 + --json 双通道同源可见）且不改退出码；失配非持久（重推导即复原） | 人话与 --json 双通道静默分叉 | "PL2 plainSelfCheck…" |
| PL3 | suspend 史无 pending → PENDING-USER 菜单：`deriveState.suspendUnresolved`（未消解 suspend 判定与 reconcileSuspend cleared 扫描同款）为真而 pending.md 缺失 → 人话段输出与挂起态同款菜单（①继续 ②手修后继续 ③停止），前缀披露"挂起史未消解而 pending.md 缺失（历史事件无载荷不可重建）"；消解后不触发；常规挂起菜单不回归 | 无载荷挂起史静默丢失（状态机无出口卡死） | "PL3 suspend 史无 pending…" |
| PL4 | ARCH-B secFresh 单点收敛：节新鲜度判定（whole sec 表命中 ∨ delta 头 sha 命中）收敛为单一导出函数，deriveState 完备性 / buildQueue 冻结窗队列 / buildQueue review 队列 / final-gate 完备性矩阵四消费点同源；preamble-only（首标题前正文）/ 无标题全文 / 空节（标题后无正文）/ BOM 开头四态两侧同判（BOM 不产生两侧分歧） | 谓词拷贝漂移（status 判 fresh、终检判 stale 的对立裁判） | "PL4 ARCH-B 四态…" |

## 守卫判据（S3①②⑤ + ENG-1/2/4 落地）

**判据权威登记于此**——改判据 = 改 `status.mjs`（守卫信号/事件生产/writeAtomic）或 `cli-guard.mjs` + 本表 + 对应用例，三处同步。S3② 语义：**水位为主信号、budget 为兜底上限**（N 降级为保险丝——只改措辞与文档，budget 判定逻辑不动）。守卫信号 env 注入点：`GUARD_RAM_MB` / `GUARD_CTX_PCT`（测试经 CLI 子进程传 env 钉死正反；S3b〔E1+Q2〕起三测试文件〔status/import-draft/sizes〕顶部**无条件** `GUARD_RAM_MB="99999"` + 剥 `GUARD_CTX_PCT` + 自证行，真实系统读数不进断言路径；env 解析空串/纯空白视同缺省——RA2）。

| # | 判据 | 防什么 | 钉死用例（unit/status.test.mjs） |
|---|------|--------|----------------------------------|
| GR1 | S3① RAM 守卫：`availableRamMb()`（env `GUARD_RAM_MB` 可解析 ≥0 → 直接返回（注入点优先级最高）→ `free -m` Mem: 行 available 列（无则退 buff/cache）→ `os.freemem()` → null fail-open）< `GUARD_RAM_MIN_MB`(500) → dispatch 拒绝：不物化不追加 dispatch，appendEvents `session-end`(ram-guard:NMB) + cold-start.md/status.md 再生收尾，exit 4；env 钉死正反（1 → 拒 / 99999 → 正常物化；默认路径冒烟由 CS 用例覆盖不冲突） | 低内存机器派发打满 OOM 死机（CLAUDE.md 纪律） | "GR1 S3① RAM 守卫…" |
| GR2 | S3② 水位退出：`ctxPctFromEnv()`（env `GUARD_CTX_PCT` 0-100 有限数 → 值，否则 null）< `GUARD_CTX_MIN_PCT`(20) → 不物化但走正常收尾（mtime 对账 / status.md / cold-start.md 含"## 下次动作"），appendEvents `session-end`(ctx-watermark:N%)，exit 0（干净退出点）；缺省（未注入且本轮确要派发）→ WARN 放行（人话 ⚠ + `--json` state.warnings 同源）；≥20 → 正常派发无水位行 | 上下文耗尽硬截断丢交接 | "GR2 S3② 水位退出…" |
| GR3 | ENG-1 合并单次原子追加：`dispatchEventsBatch(q, dispatch, inFreeze)` 导出纯函数（每单元 dispatch（c4 detail 同现行口径）+ 冻结窗末尾一条 freeze-round(units=q.length)）——run() 单次 appendEvents 落流，双追加窗关闭（原 dispatch 与 freeze-round 两次追加间崩溃可超 ≤2 门一格，有界于崩溃次数）；集成：冻结窗 dispatch → events 末条 freeze-round、此前恰为本批 dispatch | 崩溃窗内计数器越门一格 | "GR3 ENG-1 dispatchEventsBatch 纯函数…"、"GR3 ENG-1 集成…" |
| GR4 | ENG-2 目录 fsync：writeAtomic rename 后 best-effort fsync 目标所在目录（平台不支持（如 Windows 目录句柄）catch 跳过）——断电下目录项持久（文件内容 fsync 而目录项丢失 → rename 丢失）；行为级断言（monkey-patch fs.openSync/fs.fsyncSync 记录 fsync 路径，patch finally 还原），禁 source grep | rename 后断电目录项未持久 | "GR4 ENG-2 目录 fsync…" |
| GR5 | S3⑤ symlink 调用防呆：`cli-guard.mjs` `symlinkCliGuard(argv1)`（resolve ≠ realpath → 命中 {real, msg}；realpath 失败 → null 不误伤）接入全部 11 个 CLI 脚本（既有 CLI 守卫之前顶层执行，segment 从 `../cli-guard.mjs` import）——经 symlink 调用 → stderr 警示（含真实路径）+ exit 4；真实路径直连不受影响 | symlink 目录（.claude/skills 等）下 CLI 入口守卫静默失配 no-op 假绿（memory 记载事故） | "GR5 S3⑤ symlink 防呆…" |
| GR6 | ENG-4 预算收尾 session-end 生产者：`wantDispatch && overBudget && !pending` 且本轮因此未物化 → 渲染前一次性 appendEvents `session-end`(budget:N)（追加后不重推导 state，人话仍按已渲染口径）；重读 `deriveCounters` → `dispatchedSinceSessionEnd=0`——R14 计数器跨会话复位自此真正工作（RAM 守卫/水位退出同产 session-end，守卫出口也是会话边界） | 预算退出只渲染不落流，窗计数永不归零 | "GR6 ENG-4 预算收尾 session-end…" |

## S3b 判据（ARCH-A 重入收敛 + ENG-3 + riders，S3b 落地）

**判据权威登记于此**——改判据 = 改 `import-draft.mjs`（重入收敛/失败码传播）/ `status.mjs`（parseGuardEnv/LC_ALL/注行/resume 消解集/writeAtomic finally）/ `handoff.mjs`（BOM 剥离）+ 本表 + 对应用例，三处同步。G3 三角色评审收敛语义五点的验收口径 = ② 的两出口成员判定（QA 收紧版）。

| # | 判据 | 防什么 | 钉死用例 |
|---|------|--------|----------|
| BA1 | ARCH-A①③ 已移件识别 + 在途态续完：归档产物（reviews-r1/、events-r1.jsonl、verify-results-r1.json）与 writeAtomic 中断残留（*.tmp）重入时识别为已完成标记跳过（不进缺省隔离/WARN/quarantine）；events 已迁而 import 事件未落 → 以 import 事件为提交点续完（不重做已迁移部分，未移件照常执行） | 边界执行中断重入的**静默再分桶**半态（已移件二次挪进 quarantine + WARN → exit 0 假象收敛） | unit/import-draft.test.mjs "ARCH-A①③ 在途半态重入续完：已移件识别（-r1/tmp 跳过不隔离）+ events 已迁而 import 未落 → exit 0 收敛" |
| BA2 | ARCH-A④ 真冲突保留：源+目标并存（events 两侧/reviews sibling/隔离区同名）→ 重入 exit 1 + 可操作文案，不覆盖既有归档；人工处置后重入恢复收敛（exit 1 是出口不是死路） | 收敛修复把真冲突"修复"掉（静默覆盖/丢弃人工裁决域） | unit/import-draft.test.mjs "ARCH-A④ 真冲突保留：源+目标并存 → 重入 exit 1 不"修复"（归档/隔离区/events 三形态）" |
| BA3 | ARCH-A② 收敛性机械枚举（QA 收紧验收口径）：monkey-patch fs 变异计数器包住 import-draft 执行路径全部变异调用（mkdir/rename/rm/writeFile/writeSync/fsync/写型 open），第 k 次变异**前**抛错模拟中断，k=1..N 全遍历（N 随实现自动演进）；对每个 k 首次部分执行 → 重入 ∈ 两出口之一：**exit 0 且二次重入不动点**（归一化树快照全等 + events 首事件=import + "已导入过"披露 + 终态=参照终态 + quarantine 终集=参照且 partial 已在场件不挪动 + r1/tmp 绝不入 quarantine）或 **exit 1 且 errors 含可操作文案**；被 best-effort 容错吞没的变异点（writeAtomic 目录 fsync catch）如实跳过计数披露 | 重入不收敛的任何形态（新增变异点/新半态逃逸枚举——改实现不改测试即自动纳入） | unit/import-draft.test.mjs "ARCH-A② 收敛性机械枚举：k=1..N 全遍历——重入 ∈ {exit 0 二次重入不动点+零漂移, exit 1 可操作文案}" |
| BE3 | ENG-3 已导入分支失败码传播：幂等重入（首事件=import）时 statusRun 失败 → 返回其非零码与 errors（含 `--json` 通道），仍披露幂等上下文；确定性夹具 = manifest 目录化（预检 existsSync 过、读侧失败） | 幂等分支恒 exit 0 吞码（状态重建失败被"已导入过"掩盖） | unit/import-draft.test.mjs "ENG-3 已导入分支失败码传播：manifest 损毁 → 重入返回 statusRun 非零码 + errors（--json 通道同断言）" |
| RA2 | A2 守卫 env 解析：`parseGuardEnv` 纯函数——空串/纯空白视同缺省（null），可解析有限数（"500"/"12.5"）返回值（**勿用 isInteger 收紧**）；GUARD_RAM_MB="" 不假性 0MB exit 4、GUARD_CTX_PCT="" 走缺省 WARN 放行（子进程集成） | `Number("")`=0 假触发（外层 shell `GUARD_X=` 残留即假 exit 4 / 假水位 0%） | unit/status.test.mjs "A2 parseGuardEnv 纯函数…"、"A2 集成行：子进程 GUARD_CTX_PCT=\"\" 走缺省 WARN 放行…" |
| RE2 | E2 free -m 解析钉 LC_ALL=C：spawn env 恒带 `LC_ALL: "C"`（PATH 注入探针 free 行为级验证——非 C 分支输出本地化列形解析失败，C 分支 available 列可判） | 非 C locale 误判 available 列（本地化表头/逗号小数） | unit/status.test.mjs "E2 availableRamMb free -m 解析钉 LC_ALL=C…" |
| RA3 | A3 守卫/水位出口动作指令段注行：RAM/水位分支 status.md 动作段各带"注：…本轮不派发…"行（镜像 overBudget 注行形态）；yaml 结构不动（头行+空清单系既有形态）；常态无注行 | 守卫出口动作段裸收尾（头行+空清单无解释——PL1 字节等式夹具保持绿的前提下补披露） | unit/status.test.mjs "A3 守卫/水位出口动作指令段镜像注行…" |
| RA4 | A4 suspendUnresolved 消解集含 resume（两处同源常量 `SUSPEND_RESOLVERS`：reconcileSuspend cleared 扫描 + deriveState suspUncleared 扫描）：[suspend,resume]→已消解；[suspend,resume,suspend]→再次未消解（防修过头）；pending-clear/unseal/restart 不回归 | "继续翻译"（verb continue 对无 pending 挂起史落 resume 事件）后仍按未消解挂起卡菜单 | unit/status.test.mjs "A4 suspendUnresolved 消解集含 resume…" |
| RE3 | E3+Q3 目录 fsync 容错与句柄：writeAtomic 目录 fsync 抛错（平台不支持形态，monkey-patch 定向抛）→ appendEvents 仍成功（Q3 catch 分支）且目录 fd 必 closeSync（E3：原 fsync 抛出时 closeSync 被 catch 吞 → fd 泄漏一次/调用；逐调用关闭无累积） | best-effort 容错演变成句柄泄漏 | unit/status.test.mjs "E3+Q3 目录 fsync 抛错（平台不支持形态）…" |
| SE4 | E4 风格卡投影 BOM：renderStyleProjection split 前剥前导 U+FEFF——BOM 开头卡首节不丢（原被"标题前正文"静默丢弃）；只剥前导（节内容行内 BOM 原样保留）；无 BOM 卡输出字节不变（BOM 版=无 BOM 版逐字节） | BOM 卡首节规则静默丢失（无 WARN 无披露） | unit/handoff.test.mjs "SP3（E4, S3b）：BOM 开头卡首节不丢…" |
| TE1 | E1+Q2 守卫 env 测试钉死封闭：status / import-draft / sizes 三测试文件顶部**无条件赋值** `GUARD_RAM_MB="99999"`（原 `??=` 条件赋值会被外层残留低值放行）+ 剥 GUARD_CTX_PCT + 自证行（钉不牢即文件级失败，不静默假红/假绿）；sizes 原完全未钉 | 外层 shell 守卫 env 残留致 in-process 用例整体假红（水位<20 不物化）/假 exit 4 | 三文件顶部钉死块 + 自证行（夹具级判据，无具名用例；GR2 的 in-process 信号段与 A2 集成行即消费方） |
| TQ1 | Q1 FR5 "action 空"字面断言：冻结窗复欠队列在场时 `r.queue.action === null`（原仅注释） | 复欠优先级契约无字面钉（回归时 action 悄悄带回全局动作） | unit/status.test.mjs "S2③ 冻结窗复欠队列…"（S3b 补断言） |
| TQ4 | Q4 FX4 真实探针 NN 夹具：`--verb fix --nn 901`（探针虚拟 NN 段）→ exit 1（原以 nn=99 替身隐式覆盖"探针进不了 fixer"） | 探针虚拟段与真实段将来若解耦（manifest 收录 901+）静默混入修复流 | unit/status.test.mjs "S2④ fixer 包物化：报告全文+译文+定位块进包；--dims 选维；fix 事件计轮；入参校验"（S3b 补断言） |

## 维护规约

1. 新脚本的测试进对应层：算法行为 → `unit/<模块>.test.mjs`；真实文档回归按被测对象选型——**尺寸角色型**（segment 类）→ `regression/fixtures/<类>/<类>-NN.md` 单文件夹具；**行为场景型**（merge/final-gate 类）→ `regression/fixtures/<模块>/<场景>/case-NN/` 工作目录快照夹具。两者都目录自动发现、固定判据表先登记后编码（首个场景型 = merge，M1-M7，见上节）。
2. 夹具是**数据不是代码**：不改写内容；真实事故原文优先（回归价值最高）。
3. 评估标准修改 = 设计变更，须先改 DESIGN 再动测试（防"改标准凑通过"）。
4. 本目录是开发期资产，不属 SKILL.md §5.2 引用封闭集（该集合只管运行时引用文件）。
