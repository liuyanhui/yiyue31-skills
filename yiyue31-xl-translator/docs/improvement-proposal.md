# yiyue31-xl-translator 改进提案（S1）

> v1.1（10-16：G1 5/5 有条件通过，处置落齐；v1.0=同日初稿+Evaluator 三修正）。三源：①analysis-4points（10 缺陷+4 发现+成本解剖）②context-overflow（8 对策）③plan-review（v3/v4+G1§八）。批复前不改代码。

## 0. 总纲

默认=draft-import 内容继承+新契约审校层重建（v4 定，重头译仅 fallback）。不触碰内容有效性规则（文风卡/注释密度/双语锚/brief 复用）→§12 初判：继承有效。

## 1. 三目标与核销计数

正确性=判定与事实一致；健壮性=中断可恢复；完备性=覆盖真实形态。核销：① 10/10+4/4；② 8/8；③ v3 13/13、v4 7/7——**42 编号条目+①§① 依据行（不计核销）=43 行，无无去向**（§2）。

## 2. 三源核销表（目标→去向）

| 源# | 条目 | 目标→去向 |
|---|---|---|
|①1|节级锚+delta 重审 |正+完→S2①②|
|①2|内容冻结窗 |正→S2③|
|①3|配额窗支配墙钟 |健→S3②+CronCreate 调度层|
|①4|预算级联余量 |完→S4③+S3④|
|①5|status 人话误报 |正→S3④|
|①6|suspend 不落 pending |健→S2⑤|
|①7|events 断档 |正+健→S2⑤；对账 §9|
|①8|冷启动成本高 |完+健→S3③|
|①9|半块×4 偏重 |完→§8+P1|
|①10|pm-review 全局锚 |正+完→S4②|
|①§①|成本解剖（104 基线/240 派发/72 欠账/2-3×→1.3×） |完→§4 依据链|
|①④1|SessionEnd 杂物 |—→调度层（H1 已毕）|
|①④2|free -m 自适应 |健→S3①|
|①④3|verify-results 分档 |正→S4④|
|①④4|统稿先于终轮入 Step 8 |正→S2③|
|②1|水位退出 |健→S3②|
|②2|fixer 闭环 |健+完→S2④|
|②3|决策落盘纪律 |正→S2③|
|②4|RAM 双计数器 |健→S3①|
|②5|物化即派发 |健→P1 约束+S3②|
|②6|粒度解耦+40KB |完→S2①+§5|
|②7|冷启动卡自动化 |完→S3③|
|②8|compact 预案 |健→决策落盘（S2③）+退出再生（S3②）；宿主无钩子|
|③v3正1|status 同源 |正→S3④|
|③v3正2|gate 口径=报告契约 |正→S2①②|
|③v3正3|symlink 防呆 |正→S3⑤|
|③v3健1|RAM 守卫 |健→S3①|
|③v3健2|水位退出 |健→S3②|
|③v3健3|原子写 |健→S2⑤|
|③v3健4|中断可恢复 |健→S2⑤+S3②夹具幂等|
|③v3健5|schema 版本化 |健→S2⑥→S4①|
|③v3完1|迁移路径 |完→S2⑥+P1（§7）|
|③v3完2|预算 ×2.5 |完→S4③|
|③v3完3|fixer |完→S2④|
|③v3完4|冷启动再生 |完→S3③|
|③v3完5|回归体系化 |完→各批|
|③v4-1|默认不重头 |完→P1+§12|
|③v4-2|draft-import |完→S2⑥+P1|
|③v4-3|SKILL.md ≤20/16KB |完→sizes 每批断言|
|③v4-4|脚本长文档瘦 |完→S2-S4|
|③v4-5|包 ≤40KB+投影 ≤2KB |完→S2④/S3+sizes|
|③v4-6|尺寸断言三档 |完→S2|
|③v4-7|tripwire×2 |正→§12|

## 3. 分批明细与机械验收

绿=run.sh 退出码 0+断言全过；用例进 scripts/test；实现/评估分会话。final-gate 的 G3/G4 改称**检-3（括注对账）/检-4（冷读覆盖）**避撞评审门。

### S2（7 项 ~2 窗；**①②合并 ~1 窗**：报告头单 sha→逐节 sha 表，涟及 4 份 evaluate-*.md+gate+halves+staging+probe）
| # | 项 | 机械验收 |
|---|---|---|
|①|节级 sha 锚（三脚本）|夹具：3 节改节 2→--json 仅节 2 stale；gate 豁免未变节、节 2 FAIL（正反退出码）|
|②|delta+C4 拆分（头/枚举/起止→status.mjs；grep→agent；抽 ≥3 留种子）|delta 队列=变化节×4 维；--seed N 同 seed 同抽样；头三行解析。细化项：抽核对象=C4 块落 events detail|
|③|冻结窗入 Step 8（≤2 硬门）+决策落盘纪律行|>2→dispatch 非零；grep 冻结 SKILL.md 命中 Step 8。**双计数器**：冻结窗补审轮（Step 8 终轮后，项目级，≤2，>2→非零退出+pending.md 上报）vs 修复环轮（Step 7，每 chunk ≤3，超限停该 chunk 登 residue），P1 并行不挤占|
|④|fixer 闭环（主上下文不进报告）|fix-loop.md ≤6KB；fixer 包 sizes ≤40KB；探针走通 FAIL→fixer→verify→复欠|
|⑤|suspend/pending 同事务+events 原子写|中断夹具后 events.jsonl 逐行可解析；suspend 后 pending.md 必在。细化项：撕裂尾行 WARN+忽略|
|⑥|draft-import 最小实现（版本戳；旧格式非零拒收）|探针小文档全流程；旧 status.md 导入→非零拒收；version 在场。细化项：`schema:` 入 status 头|
|⑦|probe 新 run+truth|--run soai-r2；--probe-truth 伪报告命中；status 派发 >90 WARN（§12）|

### S3（5 项 ~1.5 窗）
| # | 项 | 机械验收 |
|---|---|---|
|①|RAM 守卫（free<500MB 不派）|GUARD_RAM_MB=999999→dispatch 非零拒绝；默认正常。细化项：正反 env 钉死+默认仅冒烟|
|②|水位退出（<20% 退出+再生 handoff；N 降保险丝）|GUARD_CTX_PCT 注入→退出码 0+cold-start.md 再生含下次动作。**信号源**：主 agent 按已处理单元×实测成本估剩余上下文经 GUARD_CTX_PCT 传入 preflight；代理=events `dispatchedSinceSessionEnd` 计数；缺省 WARN 放行；纪律入 SKILL.md 派发节|
|③|冷启动卡自动再生|夹具 dispatch→cold-start.md 欠账表与 --json 同源一致|
|④|人话行同源；suspend 无 pending→菜单|同函数生成断言；夹具→输出含 PENDING-USER 菜单|
|⑤|symlink 防呆|经 symlink 调用→stderr 警示+非零退出|

注：风格卡投影 ≤2KB**归 S3**（handoff.mjs）；验收=chunk-05（16,676B 最大包）整包 sizes ≤40KB。超限出口：包实测 >40KB→首审切半送审（delta 仍节级）。

### S4（5 项 ~1 窗；启动门=R1 清零）
| # | 项 | 机械验收 |
|---|---|---|
|①|schema 完整版本化+迁移|旧版本 fixture 升级语义等价断言|
|②|pm-review 逐 chunk 锚+增量补读|逐 chunk sha 行解析；只补读变更 chunk|
|③|预算公告 ×2.5 档|Step 0 模板含 ×2.5 行；数字脚本推导单测|
|④|verify-results 按 run 分档|固定路径=最新档，脚本读取不断（fixture）；历史归档|
|⑤|配额窗对策（调度层规程）|ops-runbook.md 含错峰续跑（grep）；SKILL.md 无 cron 细节|

### P1 对齐
补：a) 在途 2 staging 单元并入 chunk-11 整 chunk 无条件重物化；b) 冷读重跑（≥2 名，>100KB）——原序未列，检-4 需新 sha 台账（已入 §4）。验收：gate exit 0 且 0 stale；术语 grep（白名单 proxy"代理"/认证"令牌"）过；双语抽查 3 chunk；residue 内嵌终稿；REPORT 含对账基准。

## 4. 成本估算与总耗预算

依据：占空比 19%（20-26h/136h）→每窗派发 ≈15（240/16 窗）；审校基线 104；级联 2-3×（72 欠账）→新 1.3×；上限 120（§8）。

| 批 | 窗 | 拆分 |
|---|---|---|
|S2|2.0|①②合并 ~1（§3）；余 .3/.2/.4/.2|
|S3|1.5|RAM .3/水位 .4/冷启动 .3/同源 .2/防呆 .2+缓冲 .1|
|S4|1.0|5 项各 ~.2|
|缓冲|0.5|评审返工与夹具修补|
|**合计（总耗预算/熔断基数）**|**5 窗**|熔断线 7.5 窗：>7.5 停下上报|

计量边界：5 窗=改造全程（S1 .5+S2 2+S3 1.5+S4 1，评审当量入各批窗）；凭证=WORKLOG 记窗——不可测的熔断等于没有熔断；全旅程=5+2.5-3.5≈**7.5-8.5 窗**。

**P1（双口径，原"≤2 窗"作废待批复）**：保守上界 5 窗（15 派发/窗直算）；错峰 runbook 前移 P1 前+水位退出生效后预期 **2.5-3.5 窗**。**熔断双计量：当量 ≥90（选型重评）／≥120（绝对上限）／窗 >3.5，任一触线即停**。构成：52 首审+delta ~16+fixer 4-8+冷读 2+pm 1≈75-80 派发。

## 5. 上下文预算表

| 项 | 实测基线 | 红线 | 改造后预期 |
|---|---|---|---|
|SKILL.md|23,633B/131 行|≤20KB 硬/≤16KB 目标|推演 ~17.2/备选后 ~16.4KB；≤16KB 软目标，20KB 硬上限（sizes 批批断言，口径=批末交付态）|
|references|单件 2,449-5,515B（9 件 33,384B）|≤6KB/件懒加载|新增 7-8 件均 ≤6KB|
|scripts|0|保持 0|0|
|单元包|半块 ≈31-33KB（staging 8.1+原文 15.3+风格卡 7.0+投影 1.4+brief .4）|≤40KB|整 chunk 35-37KB（max 36.8KB；前提与超限出口见 §3 注）；delta 包 8-15KB|
|风格卡|7,036B 全文进每包（超红线）|投影 ≤2KB/包|handoff.mjs 投影；全文仅进主上下文|

## 6. SKILL.md 瘦身迁出映射（6+5+N）

### 6.1 现有复杂度迁出（行号=现 SKILL.md）
| # | 现位置 | 去向 | 减量 |
|---|---|---|---|
|1|L73-77 C4 口径模板|status.mjs dispatch 自动派生；grep 核对留 agent+test|.7KB|
|2|L83+85 C5 回核、升级计数器|C5→references/fix-loop.md；计数器→status.mjs+test|.8KB|
|3|L88-90 统稿三段式+stale 分类|references/unify.md|.9KB|
|4|L93 冷读者接力细则|references/cold-reader.md 扩|.7KB|
|5|L99-101 gate 重执行清单（**L102 半径分级/PENDING-USER=运行时纪律，留守**）|scripts/test/README.md 判据契约|1.0KB|
|6|L108-112+115-116 D1/动词表/brief 分类（**L113/L114 留守**派发节；探针加自检）|references/env-playbook.md、verbs.md|1.4KB|
|7|L129 双语对照细则|references/bilingual.md|1.5KB|
|8（备选）|L44-49 glossary 打回/投影|references/analysis.md|.8KB|
|9|L72 半块送审段改写（节级一句化）|改写净减入账|.3KB|

### 6.2 新增能力生于脚本（SKILL.md 仅一行引用）
draft-import=`import-draft`+版本戳（S2⑥）；节级锚=三脚本+夹具（S2①）；delta 队列=差集（S2②）；RAM/水位=preflight（GUARD_RAM_MB/GUARD_CTX_PCT，S3①②）；sizes 三档挂 run.sh；冻结窗=硬门（S2③）。

### 6.3 N 项细则→references 懒加载（≤6KB/件）
fix-loop/unify/env-playbook/verbs/bilingual/import/cold-reader 扩/analysis（备选）=7-8 件；撰写工时分摊各批（细化项）。

推演：23,633−7.3+0.9~1.1≈**17.2-17.4KB**＜20KB；备选后 ≈16.4；≤16KB 软目标=备选+继续迁出+sizes 兜底。

## 7. draft-import 边界清单（受/拒/隔离/重建）

| 产物 | 态 | 理由 |
|---|---|---|
|original-*.md（189,783B，sha bdb870455a75）|受|分母锚|
|chunks/（13 件 9.2-15.3KB）|受|拼接 sha 复核|
|manifest.md|受|chunk 回切锚|
|translated-chunks/（13 件 9.5-16.7KB；min 9,548/max 16,676B）|受|继承核心；节 sha 重算|
|brief.md / style-card.md|受|复用；无内容有效性变更|
|glossary/keep-list-*.json/special-phrases/terms|受|术语契约|
|adjudications/（13）|受|检-3 括注对账分母|
|analysis-notes-*.md|受|residue 登记|
|analysis-context-overflow/review-pre-translation/extract-b*.md|隔离|分析与译前历史件|
|consistency-*.md、coldseg、log|隔离|旧证据与历史痕迹|
|handoff/（规划件与 *-chunk-* 件）|隔离/重建按件|规划/交接件=隔离；projection/context 按需重建|
|reviews/（122 含 fix-log）|隔离|半块锚不可诚实迁移；rename reviews-r1/（§11）|
|staging/（12）|拒+重物化|在途 2 单元与节锚不兼容，无条件重物化；余清空|
|status.md|重建|旧 schema 无戳→拒收（S2⑥）；"delivered"系误报|
|events.jsonl|拒+新建|禁补记（断档自 10-15 05:04）；rename 归档|
|verify-results.json|拒+重跑|混存不可信；rename 隔离后重跑（S4④ 分档）|
|merged-draft.md|拒|merge.mjs 重跑|
|pm-review-*.md|拒|sha 锚失效，按新 sha 重生成|
|cold-read-*.md|拒+重跑|台账不可迁移；检-4 需新台账|
|REPORT.md|重建|新 run REPORT 含对账披露|
|probe truth soai-r1.json|拒|新 run+truth（S2⑦=soai-r2）|

缺省：未列产物默认隔离（WARN+不导入），纳入须修清单。
输入契约：chunk 回切锚=manifest.md；brief/风格卡复用现文件；events.jsonl 新建禁补记；verify-results 强制重跑。

## 8. 审校粒度选型（限 S2 能力内三选一）

| 案 | 首审单元 | 包 vs 40KB | 总派发（+delta 1.3×） | 判定 |
|---|---|---|---|---|
|**整 chunk×4**|52|35-37KB（max 36.8KB；前提见 §3 注）|≈68|**推荐**|
|半块×4|104|31-33KB（实测）|≈135|否|
|节级×4|980（节实测 245，13-25/chunk）|8-15KB|>1000|否|

判据：① 40KB 见表。② 防造假上限 **120 总派发**：半块 104 首审×级联 2×=208≈SDLC 造假点 212（53×4）——旧契约半块已贴造假区；1.3 乘数下半块 135 裕量 36%、整 chunk 68 裕量 68%、P1 计划 75-80 裕量 ≥62%；120 恰排除半块（135>120）放行整 chunk（68<120），与 §12 的 90 自洽（90 重评/120 排除）；cap 不敏感（[68,135) 任选推荐不变）。③ 开销：每单元编排 3-5k token（实测），52 vs 104 减半；会话边界 3-4 vs 6-8。

**推荐：整 chunk×4 首审（全量、四维独立）+delta 节级补审（S2②）**。P1 预计：52+16+fixer 4-8+冷读 2+pm 1≈**75-80 派发**。

## 9. 事件流对账表态

默认 **REPORT 声明基准**=旧 events.jsonl（止 10-15 05:04，240 派发）+新流独立计数；首屏披露断档区间；禁补记；S2⑤ mtime>末事件 WARN 兜底。

## 10. 配额窗对策归属

水位退出→**skill**（自判自退、可测）。CronCreate 错峰续跑→**调度层规程**（前移 P1 启动前，S4⑤ 成文），不入 skill：被动触发无常驻能力（现文已声明）；cron 属宿主调度器，入 skill 增体积不可移植；由 Planner/主会话重置后 ~5min 入队"继续翻译 <title>"。

## 11. 旧首轮审校报告处置

允许作**非证明性参考输入**：隔离 reviews-r1/，不进 run glob 与 gate、不作验收证据；仅限 fixer/审校 prompt 附"历史已知问题清单"；采纳当场落 analysis-notes。**抽核池=全部新契约报告（首审 52+delta）**——覆盖首审防抄旧。

## 12. tripwire

1. 本提案或 S2-S4 改动影响内容有效性规则（文风卡/注释密度/双语锚/brief）→重算继承 vs 重头并升级用户拍板。当前**未触碰**（四类原样复用，改动全在流程契约层）。
2. 迁移+重审>重头→同上。当前继承 ≈75-80 vs 重头 ≈115-120（+50%）；**触发线=P1 审校派发 >90 即停重评**（观测点：status 计数 >90 WARN，S2⑦）。

## 13. 待批复确认项（数字自含清单）

- 总耗预算 **5 窗**/熔断线 **7.5 窗**（§4，凭证=WORKLOG 记窗）
- P1 熔断**双计量**：当量 ≥90（重评）/≥120（绝对上限）/窗 >3.5，任一触线即停（原"≤2 窗"作废）
- 防造假上限 **120 总派发**；粒度=**整 chunk×4 首审+delta 节级补审**（§8）
- 错峰 runbook **前移 P1 启动前**（§10，调度层）
- 用户保护：降级交付不豁免读者位三项（术语 grep/双语抽查/residue 摘要）；样张否决权
