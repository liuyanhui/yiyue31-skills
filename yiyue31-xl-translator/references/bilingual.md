# 双语对照（交付后只读派生，S3 自 SKILL.md「交付」迁入）

> 判据权威 = `scripts/test/README.md`「派生视图判据」B 表（B1-B8）；本文只载编排纪律，不重复判据。

## 入口两形态

- brief `双语对照: 开`：PASS 后跑 `{skill-dir}/scripts/derive-bilingual.mjs <workdir>`。
- 交付后动词 `双语对照 <title>`（幂等）。

## 产物与只读纪律

- 产物 `translated-<title>-bilingual.md` = 交付物 × 原文机械交错的只读派生视图：中文上英文下。
- 只读派生定位：非交付物、不经终检、sha 不锚、不受手修保护、幂等，永不以 `-zh.md` 结尾；不命中发布模式（refined-stock hook 只发 `-zh.md`）。
- 派生只读不覆盖交付物、不触发 sha 不符询问（WARN 一行）。

## 三态数据源（status）

- 头部嵌源交付物 sha；status 三态：未生成 / 已生成 / 已过期。

## 配对与降级（要点指针）

- 节配对锚优先、配不齐降级节级对照；降级清单随尾注与 stdout。
- 细则权威 = test/README B 表（B4/B5/B8），不在此重复。

## 字段归属

- 双语字段归交付配置非翻译参数：brief `双语对照: 关` 为缺省行，不入 KEYMAP、机械校验零可见；双语模式不放宽注释政策。

## 幂等

- 同输入重跑字节相同（无时间戳无随机）；两入口重复执行安全。
