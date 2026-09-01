// merge.regression.test.mjs — 真实译文快照回归（与 unit/merge.test.mjs 合成层互补）
//
// 夹具 = 真实中文译文 + 合成场景装置（README「行为场景类回归契约」）：
//   译文文本取自 refined-stock loop-engineering 真实交付（23.5KB，真实标题/围栏/术语/数字形态），
//   按标题节切 4 片作 chunk；verify-results.json / manifest sha 等筛选依据天然合成——它就是被测对象。
//
// 场景布局（固定命名，目录自动发现——加 case 零改码）：
//   scripts/test/regression/fixtures/merge/
//   ├── happy/case-NN/    全 passed 快照 → 正常合并（chunk 02 带空 «» 对 → 清标场景）
//   ├── partial/case-NN/  02 修复后未重验 + 03 末条 fail → 只收 01/04
//   ├── residue/case-NN/  03 含非空 «未裁定术语» → 必须拒绝
//   └── broken/case-NN/   case-01 缺 chunk / case-02 分母 sha 不符 / case-03 NN 跳号
//
// 固定评估标准 M1-M7（换 case 不变，见 scripts/test/README.md）。
// 测试把 case 拷进临时目录再跑（merge 会追加 events.jsonl——夹具只读保护）。
//
// 运行（串行纪律）：node --test scripts/test/regression/merge.regression.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { runMerge } from "../../merge.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.join(HERE, "fixtures", "merge");
const sha12 = (s) => crypto.createHash("sha1").update(s, "utf-8").digest("hex").slice(0, 12);
const nn2 = (n) => String(n).padStart(2, "0");

// 测试独立复读译文文件（不信任 merge 内部的读取与排序——M1 的独立对账端）
function readTranslated(caseDir) {
  const tdir = path.join(caseDir, "translated-chunks");
  return fs
    .readdirSync(tdir)
    .filter((f) => /^translated-chunk-(\d+)\.md$/.test(f))
    .map((f) => ({ nn: Number(f.match(/(\d+)/)[1]), text: fs.readFileSync(path.join(tdir, f), "utf-8") }))
    .sort((a, b) => a.nn - b.nn);
}

function copyCase(caseDir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mg-reg-"));
  fs.cpSync(caseDir, tmp, { recursive: true });
  return tmp;
}

// 发布模式（refined-stock scripts/lib.mjs classify 实核；fork 纪律：硬拷进测试，不跨仓 import）
const PUBLISH_PATTERNS = [
  /^(?:final|recommendation)-.+-\d{5,}\.md$/i,
  /^talk-.+\.md$/i,
  /^merge-.+\.md$/i,
  /^summary-.+\.md$/i,
  /^.+-zh\.md$/i,
];

function discover() {
  const out = [];
  for (const scenario of ["happy", "partial", "residue", "broken"]) {
    const dir = path.join(FIXTURE_ROOT, scenario);
    const cases = fs.existsSync(dir) ? fs.readdirSync(dir).filter((d) => /^case-\d+$/.test(d)).sort() : [];
    for (const c of cases) out.push({ scenario, caseDir: path.join(dir, c), label: `${scenario}/${c}` });
  }
  return out;
}

const CASES = discover();

test("夹具在位：四场景各 ≥1 case，译文为真实中文且非微小", () => {
  for (const s of ["happy", "partial", "residue", "broken"]) {
    assert.ok(CASES.some((c) => c.scenario === s), `缺 ${s} 场景夹具`);
  }
  const texts = readTranslated(path.join(FIXTURE_ROOT, "happy", "case-01"));
  assert.equal(texts.length, 4);
  for (const t of texts) {
    assert.ok(/[一-鿿]/.test(t.text), "译文须含中文（真实语形）");
    assert.ok(Buffer.byteLength(t.text, "utf-8") > 1024, "chunk 非微小（真实尺寸形态）");
  }
});

for (const { scenario, caseDir, label } of CASES) {
  test(`回归[merge] ${label}（固定标准 M1-M7）`, () => {
    const tmp = copyCase(caseDir);
    try {
      const r = runMerge(tmp);
      const mergedPath = path.join(tmp, "merged-draft.md");
      const trans = readTranslated(tmp);

      if (scenario === "happy") {
        assert.equal(r.exitCode, 0, JSON.stringify(r.errors));
        assert.deepEqual(r.included, [1, 2, 3, 4], "M2：全 passed 全收");
        assert.equal(r.cleared, 1, "M3：chunk 02 空 «» 对清标 1 处");
        // M1：独立复读按 NN 数值序拼接（清标后）=== 产物字节
        const expect = trans.map((t) => t.text.replace(/«»/g, "")).join("");
        assert.equal(fs.readFileSync(mergedPath, "utf-8"), expect, "M1/M7：字节保真拼接");
        assert.ok(!fs.readFileSync(mergedPath, "utf-8").includes("«"), "M3：产物零 «» 残留");
        // M4：临时名不命中发布模式
        for (const re of PUBLISH_PATTERNS) assert.ok(!re.test(path.basename(mergedPath)), `M4：命中发布模式 ${re}`);
        // M5：同输入重跑字节相同
        const b1 = fs.readFileSync(mergedPath, "utf-8");
        const r2 = runMerge(tmp);
        assert.equal(r2.exitCode, 0);
        assert.equal(fs.readFileSync(mergedPath, "utf-8"), b1, "M5：确定性重跑");
        // M3：清标有记录（events.jsonl）
        const ev = fs.readFileSync(path.join(tmp, "events.jsonl"), "utf-8").trim().split("\n").map((l) => JSON.parse(l));
        assert.ok(ev.some((e) => e.ev === "merge" && e.clearedMarkers === 1), "清标事件已记");
        assert.equal(ev.at(-1).mergedSha, sha12(b1));
        // M7：无 BOM
        const buf = fs.readFileSync(mergedPath);
        assert.ok(!(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf), "M7：无 BOM");
      } else if (scenario === "partial") {
        assert.equal(r.exitCode, 0, JSON.stringify(r.errors));
        assert.deepEqual(r.included, [1, 4], "M2：只收最新 passed（02 过期 / 03 未过）");
        assert.equal(r.excluded.length, 2);
        const expect = trans.filter((t) => [1, 4].includes(t.nn)).map((t) => t.text).join("");
        assert.equal(fs.readFileSync(mergedPath, "utf-8"), expect, "只含 passed 字节");
      } else if (scenario === "residue") {
        assert.equal(r.exitCode, 4, "«» 残留必须拒绝");
        assert.ok(r.errors.join("").includes("«未裁定术语»"), "报错点名残留标记");
        assert.ok(!fs.existsSync(mergedPath), "拒绝落盘");
      } else {
        // broken：非零退出 + 可操作报错 + 绝不静默拼残稿
        assert.notEqual(r.exitCode, 0, "broken 输入必须非零退出");
        assert.ok(r.errors?.length, "须有可操作报错");
        assert.ok(!fs.existsSync(mergedPath), "M6：绝不静默拼残稿");
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
}
