# Phase 0 角色②：xl 内核审查——冲突清单

- 评审日期：2026-09-19
- 输入：HANDOFF §1/§3 + yiyue31-xl-translator/SKILL.md（佐证：scripts/final-gate.mjs、status.mjs、verify-mech.mjs）

## 结论一行

六机制与 §1 已定决策**零硬冲突**（无一条需要回改决策）；5 条发现全部是 Phase 1 落地完整性/文档一致性要求——其中 C2、C3 必须进 T1.5 措辞清单（漏掉会造成 SKILL.md 字面自相矛盾或过期视图误导），C1 为输入边界外的待核验项。

## 冲突清单

**C1** | §1.1（命名永不以 `-zh.md` 结尾、无发布前缀）| 机制1 + 机制5 | HANDOFF §0 断言"bilingual 天然不命中 refined-stock classify"，但 refined-stock 仓库不在本次输入边界内，未经核验。若其发布/分类 glob 是宽松的 `translated-*` 形态而非 `translated-*-zh.md` 精确形态，`translated-<title>-bilingual.md` 会被发布管线误拾，"只读视图"身份即破。xl 侧证据只能证明**本 skill 内部**零命中（final-gate.mjs:318 交付物精确名 `translated-${title}-zh.md`；status.mjs:230 精确正则 `^translated-${title}-zh\.md$`；无任何 `translated-*` 松匹配）| **待核验**。核验方法：grep refined-stock 仓库的 classify/publish 匹配模式，确认是 `-zh.md` 锚定结尾；若非，派生命名需回报用户。

**C2** | §1.7（交付物 sha ≠ REPORT 锚时派生照跑 + WARN 一行）| 机制5 | SKILL.md 横切机制「交付后」原文："交付物 sha 已锚入 REPORT，**再入不符 = 用户手改 → 询问**'保留手修 or 按流程产物重新交付'（手修永不覆盖）"。两条规则对**同一检测条件**（sha 不符）给出相反动作（问 vs 跑）。意图层面不冲突——询问规则的保护对象是交付物不被覆盖（final-gate.mjs:506-521 deliverable-guard + 原子改名拒绝覆盖），而派生只读、绝不写交付物，无覆盖风险——但 SKILL.md 层面若不显式豁免，执行 agent 面对同一信号无所适从 | T1.5「交付节补双语版说明一行」的这一行必须写显式豁免句："派生视图生成不触发此询问——派生只读不覆盖交付物，WARN 一行即止"。进 T1.5 措辞清单。

**C3** | §1.1（幂等可重生成）+ §1.5③（服务存量已交付项目）| 机制6（+ 机制3 的 restart 面）| **过期双语版无任何失效信号**。三条再交付路径都会让旧 bilingual（基于旧交付物）静默滞留：① `重新翻译`（status.mjs:539-541 restart 只删六子目录 + manifest/merged-draft/events/pending/status，**不删根目录交付物与 bilingual**）；② 术语统一轻命令 → final-gate 重入再 PASS（交付物内容变更、REPORT 换锚）；③ re-keying/重翻后全局阶段重走再 PASS。§1.1 的"幂等可重生成"只覆盖用户**主动**重跑，无被动提示。T1.5 计划的 status 一行只显示"是否已生成"——在上述场景下"已生成"三字会误导用户读到过期视图 | 派生脚本在 bilingual 元信息头嵌**源交付物 sha**（§1.4 元信息头本就仅文件头一次，加一个字段不动格式）；T1.5 的 status.mjs 已交付行改为显示"双语版：未生成 / 已生成（基于当前交付物）/ **已过期**（交付物已更新，重说'双语对照 <title>'再生成）"。进 T1.5 措辞清单。

**C4** | §1.5③（新动词 `双语对照 <title>`）| 机制3 | SKILL.md frontmatter description（第 3 行）的触发词列表枚举了全部动词含交付后的 `审计翻译`/`查翻译质量`（与「交付」节 :128 呼应），这是本 skill"动词必入触发词"的自身惯例。T1.5 只计划改动词表正文，T1.6 只 bump 版本——**均未计划更新 frontmatter description**。漏掉则 `双语对照` 触发不可靠，存量已交付项目的用户说"双语对照 X"可能根本唤不起本 skill | T1.5 追加一项：frontmatter description 触发词补 `双语对照`。

**C5** | §1.2（brief 双语字段归交付配置）+ §1.5③ | 机制4 | Step 0 预算公告（SKILL.md:34）的 brief 披露行逐项枚举五个字段："按技术读者/意译/中等注释密度/发布用途/标题双语锚开处理……想改就说'……'"——通知非询问的设计意图 = 用户从此处知晓全部可改项。brief 新增第六字段 `双语对照` 后该枚举不全，用户无从知晓"发起时就能要双语"（§1.5③ 的 brief 组合入口对用户不可见）| T1.5 补一处：公告行披露词加 `双语对照关`（默认关），改口样例可顺带加"要双语"。

## 逐机制核对记录

### 1. 命名三条红线——已核对，相容（条件：T1.5 红线③改写必须落地；另见 C1 待核验）

- 红线①（中间产物禁止以 `-zh.md` 结尾，SKILL.md Directory :24）：bilingual 命名以 `-bilingual.md` 结尾，且其身份是终态视图非中间产物——双重不命中。
- 红线②（禁止 `summary-/talk-/merge-/final-/recommendation-` 前缀）：`translated-` 不在禁止列表（交付物自身即用此前缀）。
- 红线③（唯一交付物 `translated-<title>-zh.md` 由终检 PASS 原子改名产生——PASS 前全目录不得命中任何发布模式）：
  - "PASS 前不命中发布模式"：天然满足——bilingual 只能由派生脚本在交付物存在后生成，T1.3 已定"无交付物 → 非零退出"，PASS 前该文件不可能合法存在。
  - "唯一交付物"：同目录出现第二个 `translated-` 前缀文件，若红线③原文一字不动，"唯一交付物…由终检 PASS 原子改名产生"未给 bilingual 留位置（它不经 PASS 改名而产生）。§1.5② 的"交付物/派生视图二分"拍板正是为解决此点，T1.5 已计划"红线③追加派生视图二分表述"。**判定：决策与红线意图相容，相容性以 T1.5 该改写落地为前提**——属已计划项，不构成新冲突，但收口时须验证 T1.5 措辞确实兑现。
- 佐证：SKILL.md Directory :23-24；final-gate.mjs:318；status.mjs:230。

### 2. 终检重执行哲学——已核对，相容（代码证据充分，T1.1 判断被证实）

- 重执行哲学的对象是**交付链路产物**（"重执行一切确定性检查，不信任何落盘日志"，SKILL.md Step 10 :98）：机械校验重跑、translated-chunks 重导出 diff、拼接 sha、完备性矩阵、报告签名、锚对账、探针——全部输入为 chunks/、translated-chunks/、adjudications/、reviews/、manifest.md、glossary-/keep-list/special-phrases/brief、merged-draft 或交付物、cold-read-/pm-review-。**没有任何根目录未知文件枚举或拒绝逻辑**。
- 新鲜度 walk（唯一可能被"多一个文件"影响的点）：final-gate.mjs:487-491 只扫 `translated-chunks/chunks/adjudications/reviews` 四子目录 + `manifest.md` + `cold-read-*` 根文件——根目录的 bilingual 不入 walk，不产生 mtime WARN。
- 根目录全部读取均精确名/前缀锚定：glossary-（final-gate.mjs:289）、cold-read-（:491）、original 经 `^original-.*\.md$`（status.mjs:157 同源 scanWorkdir）——bilingual 零命中。
- 哲学层面："不经终检"与"重执行一切"不矛盾——终检背书不是唯一正确性模型；bilingual 以确定性幂等脚本 + 可随时重生成 + 降级清单随输出可见（§1.3）替代背书，且这是 §1.5② 用户拍板的二分。T1.4 的回归 fixture（"工作目录含 bilingual 文件 → 判定不变"）将把此相容性锁进测试。
- 结论：终检重入（含术语统一轻命令通道）对工作目录中的 bilingual 文件零感知、零判定变化。

### 3. 状态机动词表——已核对，相容（新增一类语义，无分类冲突；另见 C4、C3）

- 现有动词语义分类（SKILL.md 横切 :114 + status.mjs verb() :496-548）：状态迁移类（继续/停止/重翻/重新/先翻样张）+ 只读类（progress）。`双语对照 <title>` 是**交付后、有副作用、不动管线状态**的新类——不落入任何现有类的语义槽，但也不与之矛盾：幂等（重跑字节相同，同 M5 哲学）、非交付态下无交付物即非零退出（对齐 verb() exitCode 1 + 可操作错误风格，status.mjs:546）。
- 与 C3 view/dispatch 契约（SKILL.md 横切 :106；status.mjs:575-581）相容：无动词默认只读渲染不被破坏——`双语对照` 是显式动词，副作用走显式路径，与 dispatch 同构。
- 与「交付即止」相容：派生是用户显式发起，不是自动触发发布管线。
- 缺口两条已列 C4（frontmatter 触发词）与 C3（restart/再交付后旧双语版滞留——restart 删除面见 status.mjs:539-541）。

### 4. brief 语义——已核对，相容（有直接先例；另见 C5）

- 阈值/开关二元结构本就存在：阈值键走 parseBrief 的 KEYMAP + clamp 安全域（verify-mech.mjs:346-389，"只认已知数值键，**其余内容忽略**"；:351-366）；非阈值中文开关键走使用点专用正则——**`标题双语锚: off|false|关|关闭` 就是现成先例**（final-gate.mjs:131-134 anchorOff；verify-mech.mjs:567），对 parseBrief 完全不可见。`双语对照: 关` 走同构路径，不进 KEYMAP、不被行正则（`[A-Za-z-]+`，verify-mech.mjs:385）匹配——静默忽略，不触发 final-gate "brief 解析失败"（final-gate.mjs:282）。
- "归交付配置非翻译参数"在机制层面成立：双语字段对 verify()/final-gate 的阈值与判定**完全不可见**——解耦不变量（§1.2，任何"输出格式影响翻译行为"即错）无机制级破口。
- "不放宽注释政策"与 Step 5 "brief 阈值只能收紧不能放宽"（SKILL.md :64；BRIEF_CLAMP verify-mech.mjs:361-366）精神同向，且双语字段不入键域 = 不存在经 brief 放宽阈值的新通道。
- 中途变更分类（SKILL.md :115 注释密度/文风/根本三类）未覆盖交付配置类字段——但 §1.5③ 入口本就是"动词 + brief 组合"且服务 PASS 后场景，中途翻转无意义（随时可说动词），不构成冲突，T1.5 措辞时可加半句"双语字段中途改无效，PASS 后用动词"。

### 5. 交付后纪律——已核对，相容但需显式豁免句（C2）；"两文件并存"无冲突

- "PASS 后派生、两文件可并存" vs 原子改名与手修保护：改名对象是 merged-draft → 交付物（final-gate.mjs:511-521），deliverable-guard 只针对交付物本体（:506-510）——bilingual 不参与任何一条，并存无机制冲突。
- "派生照跑 + WARN" vs "再入不符 = 询问"：意图相容（保护的是交付物不被覆盖，派生只读），字面打架——已列 C2，须 T1.5 豁免句显式化。
- 交付即止 + refined-stock Stop/SessionEnd hook 只发布 PASS 后交付物：bilingual 不被误拾依赖 C1 的待核验项。

### 6. status 文件系统推导——已核对，推导零误判；"加一行"对显示而言内容不够（C3）

- 推导不会误判，依据：状态推导对根目录的全部扫描均精确/前缀锚定——交付判定 `^translated-${title}-zh\.md$`（status.mjs:230，精确正则非通配）、original（:157 `^original-.*\.md$`）、analysis-/consistency-/cold-read-/pm-review-（:223-228）。`translated-<title>-bilingual.md` 不命中任何模式：不会误判"已交付"、不会被误识为交付物、不污染阶段判定。**即使 status.mjs 一行不改，推导也安全**。
- 已交付态输出（status.mjs:444-445 "已交付（translated-…-zh.md）。"）无动作指令——T1.5 加一行显示在结构上自然。
- 但"显示是否已生成"一字段**不够**：再交付三路径（restart / 术语统一再 PASS / re-keying 重交付）下"已生成"会掩盖过期事实——须升级为"是否基于当前交付物"，已列 C3（含派生头嵌源 sha 的实现建议）。

---

*本清单为 Phase 0 评审产物：只审不改。C2/C3/C4/C5 建议并入 T1.5 措辞清单后随 Phase 1 实施；C1 在 Phase 1 动手前核验。*
