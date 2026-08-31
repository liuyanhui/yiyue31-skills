// segment.regression.test.mjs — 真实文档回归测试（与 segment.test.mjs 单元层互补）
//
// 两层分工：单元层用程序化合成样例钉死算法行为；本层用 **git 管理的真实文档夹具**
// 钉死真实世界回归——真实标题结构/围栏/表格正是旧 doc_segmenter 翻车的地方
// （64KB→56 碎片、围栏内 # 误判标题）。夹具可替换可增补，评估标准不变（见下）。
//
// 夹具布局（固定命名模式，按目录自动发现——加文档零改码）：
//   scripts/test/regression/fixtures/single/<single-NN.md>  无需切割（总长 ≤ max，单 chunk 是正确形态）
//   scripts/test/regression/fixtures/few/   <few-NN.md>     切成 2-10 个 chunk
//   scripts/test/regression/fixtures/many/  <many-NN.md>    切成 ≥11 个 chunk
// 替换/新增契约：文档落进对应目录、命名续 NN 即被自动纳入；类别判据见表，放错类会 FAIL。
//
// 固定评估标准（S1-S8，结构性判据，与具体文档无关——换文档/加文档不变）：
//   S1 关卡退出码 = 0（含拼接 sha === 原文 sha 硬关卡，exit 3 防线）
//   S2 分母保真：测试独立复读全部 chunk 文件按 NN 序拼接，字节级 === 归一化原文
//   S3 命名：全部匹配 chunk-<NN>[X]-<slug>.md；NN 从 01 连续递增无跳号
//   S4 产物一致：磁盘 chunk 数 === manifest chunk 表登记；manifest 落盘存在；progress.json 不再写出（status.md 吸收，2026-08-31）
//   S5 上界：非原子 chunk ≤ max（R11-B 散文永不超限）；原子 X 免（其形态即超限）
//   S6 反碎片地板：非原子 chunk ≥ min；唯一豁免 = 末 chunk 且并入前包超 max（结构性不可合并）
//   S7 数量角色：single = 1；few ∈ [2,10]；many ≥ 11
//   S8 碎片区间上界：chunk 数 ≤ ⌈总字节 / min⌉（退化成旧碎片病必超界）
//
// 运行（串行纪律，单文件跑）：
//   node --test scripts/test/regression/segment.regression.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../../segment/segment.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.join(HERE, "fixtures");

// 与 segment.mjs BAND 默认值同步的角色判据（评估标准的唯一参数源）
const BAND = { min: 8 * 1024, max: 15 * 1024 };
const ROLES = {
  single: { minChunks: 1, maxChunks: 1 },
  few: { minChunks: 2, maxChunks: 10 },
  many: { minChunks: 11, maxChunks: Infinity },
};

function checkDoc(filePath, role) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "seg-reg-"));
  try {
    // S1 关卡退出码
    const r = run(filePath, tmp, { quiet: true });
    assert.equal(r.exitCode, 0, `${filePath}：退出码 ${r.exitCode}（应为 0）`);
    const rows = r.rows;
    assert.ok(rows.length >= 1, `${filePath}：chunk 数为 0`);

    // S2 分母保真：独立复读拼接（不信任 run 内部已做的 sha 关卡）
    const normalized = fs.readFileSync(filePath, "utf-8").replace(/\r\n?/g, "\n");
    const joined = rows.map((x) => fs.readFileSync(path.join(tmp, "chunks", x.name), "utf-8")).join("");
    assert.ok(
      Buffer.from(joined, "utf-8").equals(Buffer.from(normalized, "utf-8")),
      `${filePath}：chunk 拼接 !== 归一化原文（分母被改动）`
    );

    // S3 命名与 NN 连续性
    rows.forEach((x, i) => {
      assert.match(
        x.name,
        /^chunk-\d{2}X?-[a-z0-9-]+\.md$/,
        `${filePath}：命名不合规 ${x.name}`
      );
      assert.equal(Number(x.name.slice(6, 8)), i + 1, `${filePath}：NN 跳号/乱序于 ${x.name}`);
    });

    // S4 产物一致（manifest 为分段唯一事实记录）
    const onDisk = fs.readdirSync(path.join(tmp, "chunks")).filter((f) => f.endsWith(".md"));
    assert.equal(onDisk.length, rows.length, `${filePath}：磁盘 chunk 数与登记不符`);
    const manifest = fs.readFileSync(path.join(tmp, "manifest.md"), "utf-8");
    const tableRows = manifest.split("\n").filter((l) => /^\| \d{2}/.test(l)).length;
    assert.equal(tableRows, rows.length, `${filePath}：manifest chunk 表行数不符`);
    for (const x of rows) assert.ok(manifest.includes(x.name), `${filePath}：manifest 缺 ${x.name}`);
    assert.ok(!fs.existsSync(path.join(tmp, "progress.json")), `${filePath}：progress.json 必须不再写出`);

    // S5 上界 + S6 反碎片地板（末块结构性不可合并豁免）
    rows.forEach((x, i) => {
      if (x.atomic) return; // 原子 X：超限即其形态
      assert.ok(x.bytes <= BAND.max, `${filePath}：非原子 chunk ${x.name} ${x.bytes}B 超 max`);
      const isLast = i === rows.length - 1;
      const prev = i > 0 ? rows[i - 1] : null;
      const unmergeable = isLast && (prev === null || prev.atomic || prev.bytes + x.bytes > BAND.max);
      if (!unmergeable) {
        assert.ok(x.bytes >= BAND.min, `${filePath}：chunk ${x.name} ${(x.bytes / 1024).toFixed(1)}KB 低于 min 且可合并（碎片病）`);
      }
    });

    // S7 数量角色
    const n = rows.length;
    assert.ok(
      n >= ROLES[role].minChunks && n <= ROLES[role].maxChunks,
      `${filePath}：chunk 数 ${n} 不在 ${role} 角色区间 [${ROLES[role].minChunks}, ${ROLES[role].maxChunks === Infinity ? "∞" : ROLES[role].maxChunks}]——放错类别或分段回归`
    );

    // S8 碎片区间上界
    const totalBytes = Buffer.byteLength(normalized, "utf-8");
    const ceiling = Math.ceil(totalBytes / BAND.min);
    assert.ok(n <= ceiling, `${filePath}：chunk 数 ${n} 超 ⌈总字节/min⌉=${ceiling}（碎片化回归）`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

for (const role of Object.keys(ROLES)) {
  const dir = path.join(FIXTURE_ROOT, role);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort() : [];

  test(`${role} 类夹具在位（≥1 篇）`, () => {
    assert.ok(files.length >= 1, `${dir} 无夹具——回归覆盖缺失`);
  });

  for (const f of files) {
    test(`回归[${role}] ${f}（固定标准 S1-S8）`, () => {
      checkDoc(path.join(dir, f), role);
    });
  }
}
