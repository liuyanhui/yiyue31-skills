# M3 回写计划（skill 修改计划）

> 来源：M3 试运行标定记录（运行仓库 `refined-stock/xl-translator/m3-outbox/M3-标定记录.md`，2026-09-03~09-11，AI-Native-SDLC-playbook 全流程终检 PASS）。
> 状态：**已裁定（2026-09-14 Yiyue 整批全按建议，R18 模式）**——B1-B5 / C1-C6 / D1-D2 全部按拟议方案实施。
> 完成定义：下表全部实施 + `bash scripts/test/run.sh` 全绿 + SKILL.md/DESIGN 回写 + 本文档按惯例删除（要义入 DESIGN §6 里程碑行与提交信息）。

## A. 已在 M3 期间即时修复（未提交，随本计划一并 commit）

| # | 项 | 文件 | 验证 |
|---|---|---|---|
| A1 | projectionFor 围栏代码块豁免（R8-c 假阳性：仅存于代码块的术语被投影，要求中文散文兑现） | scripts/handoff.mjs | unit/handoff.test.mjs +2 |
| A2 | renderProjection 别名 `|` 渲染（原 `::` 连接会被 parseProjection 吞进 zh） | scripts/handoff.mjs | unit/handoff.test.mjs +1 |
| A3 | stripMechanical 裸域名 URL 豁免（无 scheme 地址被词切分成 ≥6 词 run 误报漏译） | scripts/verify-mech.mjs | unit/verify-mech.test.mjs +1 |
| A4 | final-gate 文件名标题豁免（`### CLAUDE.md` 类 keep-list 标题无 CJK 撞"非中文标题"判） | scripts/final-gate.mjs | unit/final-gate.test.mjs 适配 |

M3 运行侧数据处置（在运行仓库，非本仓）：keep-list 删 "Teams" 词条（句首泛指碰撞）、glossary policy 行登记"策略"别名（复合词语义）。

## B. 待实施——P0 判据正确性（直接影响下次运行）

| # | 问题（M3 证据） | 拟议方案 | 改动面 | 验收 |
|---|---|---|---|---|
| B1 | **G3 无围栏豁免**：final-gate 括注集合计入围栏内代码括注（make test/.env* 等 39 项误报，靠 37 行兜底台账人力消解） | annotation 集合计算剥离围栏内（与 verify-mech stripMechanical 同源逻辑）；adjudicate-prompt.md 兜底扫描条款同步改为"围栏内不改不记" | scripts/final-gate.mjs；references/adjudicate-prompt.md | 单测：围栏内括注不进集合；M3 案例回放（39 项归零） |
| B2 | **R8-c 词头复合词粒度**：policy→政策 在 network policy（网络策略）处假阳性 | projectionFor 最长匹配优先：长短词条同现只投影长者；glossary 约定支持组合词条目（如 network policy 单列） | scripts/handoff.mjs；DESIGN §9 裁决补登 | 单测：短词条命中被长者吸收 |
| B3 | **锚行间距契约晚暴露**：verify-mexemption"第一个非空行"宽松语义放行空行分隔锚，final-gate"字面次行"终检才爆（146 项 FAIL） | verify-mech 增锚行紧贴硬判（标题次行必须字面 `*English*`），违约拦在 Step 5；SKILL.md 注明"下一行=字面次行" | scripts/verify-mech.mjs；SKILL.md | 单测：空行分隔锚 FAIL；紧贴过 |
| B4 | **keep-list 单词词条无法消歧**：Teams 产品义词条撞句首泛指（判定 includes 纯子串） | keep-list schema 加可选 `scope` 字段（词条仅在指定 chunk 生效），checkKeepList 按当前 chunk 过滤；SKILL.md 记录该字段 | scripts/verify-mech.mjs（checkKeepList）；SKILL.md | 单测：scoped 词条他 chunk 不判 |
| B5 | **inline-code 无有意规范豁免通道**：译者规范化源文笔误（`Intent.md`→`intent.md`）与逐字保留硬判无解 | verify-mech 支持 waiver 清单（`原文串→译文字串` 逐项登记，落盘 REPORT 披露）；终检重跑同清单 | scripts/verify-mech.mjs；SKILL.md | 单测：waiver 项过且计入 REPORT |

## C. 待实施——P1 成本与流程规则

| # | 问题（M3 证据） | 拟议方案 | 改动面 | 验收 |
|---|---|---|---|---|
| C1 | **半块中点级联**：a 侧修复推动字节中点越界，b 侧未动仍 stale（三例实证，重审成本 ×2） | halfSlices 改标题边界锚定：字节中点附近取最近标题行为切点（无标题回退段落边界）；DESIGN §5.1 C-1/G5 条款更新 | scripts/status.mjs；DESIGN | 单测：a 侧字节增减不改变 b 集合 |
| C2 | **探针随队重派**：fresh 探针报告仍被重派（M3 两轮共 8 单元冗余；操作侧 fresh-skip 已实证） | buildQueue 探针去重：探针报告 sha 与当前探针文本相符即不入队（真实单元不受影响） | scripts/status.mjs | 单测：fresh 探针不重复入队 |
| C3 | **status.mjs 运行副作用**：无动词运行即物化 staging+追加 dispatch 事件（36 条幻影事件案例） | 拆两动词：`view`（只读渲染，默认）/ `dispatch`（物化+事件）；SKILL.md/SOP 更新调用约定 | scripts/status.mjs；SKILL.md | 单测：view 零副作用；dispatch 行为不变 |
| C4 | **派发口径是质量变量**：两起事故（chunk 02 边界误标 4 修复未复核；chunk 05 终点误标 72% 未审）——"范围=staging 全文"兜底不敌错误终点标记 | SKILL.md 编排注记固化派发模板：staging 总行数 + 起止标题 + 所含节名枚举；派发前 grep staging 标题核对 | SKILL.md（Step 6 编排注记） | 文档项；M3 教训入注 |
| C5 | **跨维采纳无回核**：采纳 readability"化定语为主谓"建议丢 share 比例义（accuracy 次轮兜住） | SKILL.md Step 7 增规则：凡采纳非 accuracy 维的结构性改写，改后对照原文回核数字/比例/否定极性 | SKILL.md | 文档项 |
| C6 | **括注 doctrine 与注释密度档冲突**：intent home 案（首现窗口关闭后补注被判违反"只注首现"，三维度反复翻转） | adjudicate-prompt.md 明文：前 chunk 定稿裸用致首现窗口关闭时，当前 chunk 唯一/首处出现补注一次视为合规（立法本意=防重复注）；审校对已终裁项的分歧走登记，不翻转 | references/adjudicate-prompt.md | 文档项；M3 终裁案例入注 |

## D. 待实施——P2 SOP 与文档

| # | 项 | 方案 |
|---|---|---|
| D1 | **环境处置模板**（M3：7 个配额窗 + 多次流停滞击杀 20+ 单元，全靠即兴恢复） | SKILL.md 编排注记：429[1302] 突发→即补派；429[1308] 配额→定时等窗续跑；并发 ≤5 两波制；流停滞先核验无半成品再原样重派 |
| D2 | **版本与裁决回写** | SKILL.md 升 v0.3.2（B/C 条目对应条款）；DESIGN §6 里程碑补 M3 行 + §9 裁决补登（B1-B5/C1-C3 对应编号）；提交信息含测试计数 |

## 实施顺序建议

A（提交既修）→ B1-B5（判据，互相独立可并行）→ C1-C3（状态机三件，同文件串行）→ C4-C6+D1（文档）→ D2 收口。全程主 agent 直写 + 单测，`bash scripts/test/run.sh` 串行全绿为准。

## 运行侧遗留（非本仓，供参照）

- 交付物 2 项源料缺陷待 Yiyue 裁定：元信息"发布时间：2001-08-21"疑笔误；尾段承诺文档列表源文即缺失（裁定后可径改交付物，重跑 final-gate 即可）
- M3 标定记录含完整时间线与全部观测，回写时逐项对照取证
