# 测试套件（scripts/test/）

xl-translator 脚本层的统一测试目录，与源码分离（源码在 `scripts/<模块>.mjs` 与 `scripts/segment/`），随 git 管理。

## 目录结构

```
scripts/test/
├── run.sh                          # 统一入口：逐文件严格串行跑全部测试
├── README.md                       # 本文件
├── unit/                           # 单元层：程序化合成夹具（确定性，不落盘），钉死算法行为
│   ├── segment.test.mjs            #   分段算法：fence 感知/拼接 sha/落带/R11-B/产物/CLI
│   ├── status.test.mjs             #   状态机（M1b）：推导/双段契约/统一物化/stale/动词/计数器/预算
│   └── verify-mech.test.mjs        #   机械校验：原五+新四硬判、fork 源对照、CLI 冒烟
└── regression/                     # 回归层：git 管理的真实文档夹具，钉死真实世界回归
    ├── segment.regression.test.mjs
    └── fixtures/
        ├── single/  single-NN.md   # 无需切割（总长 ≤ max，单 chunk 是正确形态）
        ├── few/     few-NN.md      # 切成 2-10 个 chunk
        └── many/    many-NN.md     # 切成 ≥11 个 chunk
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
| S4 | 磁盘 chunk 数 === manifest 表 === progress.total_chunks，两产物存在 | 产物间不一致 |
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

## 维护规约

1. 新脚本的测试进对应层：算法行为 → `unit/<模块>.test.mjs`；真实文档回归按被测对象选型——**尺寸角色型**（segment 类）→ `regression/fixtures/<类>/<类>-NN.md` 单文件夹具；**行为场景型**（merge/final-gate 类）→ `regression/fixtures/<模块>/<场景>/case-NN/` 工作目录快照夹具。两者都目录自动发现、固定判据表先登记后编码（首个场景型 = merge，M1-M7，见上节）。
2. 夹具是**数据不是代码**：不改写内容；真实事故原文优先（回归价值最高）。
3. 评估标准修改 = 设计变更，须先改 DESIGN 再动测试（防"改标准凑通过"）。
4. 本目录是开发期资产，不属 SKILL.md §5.2 引用封闭集（该集合只管运行时引用文件）。
