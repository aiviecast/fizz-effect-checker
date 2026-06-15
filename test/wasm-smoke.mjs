import { readFileSync } from "node:fs";
const mod = await WebAssembly.compile(readFileSync(new URL("../build/ec.wasm", import.meta.url)));
const imports = {}; for (const i of WebAssembly.Module.imports(mod)) (imports[i.module] ??= {})[i.name] = () => 0;
const { exports: ex } = await WebAssembly.instantiate(mod, imports); try { ex._start(); } catch {}
const enc = new TextEncoder(), dec = new TextDecoder();
const writeBuf = (allocName, s) => { const b = enc.encode(s); const p = ex[allocName](b.length); new Uint8Array(ex.memory.buffer, Number(p), b.length).set(b); };
const readOut = (len) => dec.decode(new Uint8Array(ex.memory.buffer, Number(ex.out_ptr()), Number(len)));
const setEff = (e) => writeBuf("eff_alloc", e);
const setCheck = (used, allowed, model = "") => { writeBuf("used_alloc", used.join("\n")); writeBuf("allowed_alloc", allowed.join("\n")); writeBuf("model_alloc", model); };
const violations = () => { const len = ex.violations_resolve(); const s = readOut(len); return s === "" ? [] : s.split("\n"); };
let ok = true; const ck = (c, m) => { if (!c) { console.error("FAIL " + m); ok = false; } };

setEff("llm.invoke");
ck(ex.is_valid_effect() === 1, "valid effect");
ck(readOut(ex.namespace_resolve()) === "llm", "namespace");
ck(readOut(ex.action_resolve()) === "invoke", "action");
setEff("bareword");
ck(ex.is_valid_effect() === 0, "invalid (no dot)");

const allowed = ["llm.invoke", "llm.haiku"];
setCheck(["llm.invoke"], allowed);
ck(ex.all_allowed() === 1, "subset ok");
setCheck(["llm.invoke", "fs.write", "net.fetch"], allowed);
ck(ex.all_allowed() === 0, "subset violated");
ck(ex.violation_count() === 2, "2 violations");
ck(violations().join(",") === "fs.write,net.fetch", "violations: " + violations().join(","));

// runtime model: llm.sonnet は宣言に無いが model=sonnet なら許可される
setCheck(["llm.sonnet"], allowed, "");
ck(ex.all_allowed() === 0, "sonnet not allowed without model");
setCheck(["llm.sonnet"], allowed, "sonnet");
ck(ex.all_allowed() === 1, "sonnet allowed with runtime model");

// 多重読み: 同じ入力で violations を複数回 + all_allowed を挟んでも安定 (almide#690)
setCheck(["llm.invoke", "fs.write"], allowed);
const a = violations().join(","); ex.all_allowed(); const b = violations().join(",");
ck(a === "fs.write" && a === b, "multi-read violations stable");

console.log(ok ? "wasm OK — effect subset check matches native" : "FAIL"); if (!ok) process.exit(1);
