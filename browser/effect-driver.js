// effect-driver.js — kotodama / ブラウザの effect 検証 UI のグルー例。
// used ⊆ allowed 検証 = Almide(wasm)、effect の実行(LLM 等)= host runtime。
export async function loadEffectChecker(wasmUrl) {
  const bytes = await (await fetch(wasmUrl)).arrayBuffer();
  const mod = await WebAssembly.compile(bytes);
  const imports = {}; for (const i of WebAssembly.Module.imports(mod)) (imports[i.module] ??= {})[i.name] = () => 0;
  const { exports: ex } = await WebAssembly.instantiate(mod, imports); try { ex._start(); } catch {}
  const enc = new TextEncoder(), dec = new TextDecoder();
  const writeBuf = (allocName, s) => { const b = enc.encode(s); const p = ex[allocName](b.length); new Uint8Array(ex.memory.buffer, Number(p), b.length).set(b); };
  const readOut = (len) => dec.decode(new Uint8Array(ex.memory.buffer, Number(ex.out_ptr()), Number(len)));
  // model を渡すと allowed に llm.<model> が足される(eval.rs:174 の runtime 許可相当)。
  const setCheck = (used, allowed, model = "") => { writeBuf("used_alloc", used.join("\n")); writeBuf("allowed_alloc", allowed.join("\n")); writeBuf("model_alloc", model); };
  return {
    namespace(eff) { writeBuf("eff_alloc", eff); return readOut(ex.namespace_resolve()); },
    action(eff) { writeBuf("eff_alloc", eff); return readOut(ex.action_resolve()); },
    isValidEffect(eff) { writeBuf("eff_alloc", eff); return ex.is_valid_effect() === 1; },
    // used がすべて allowed(+ runtime model)に含まれるか。
    allAllowed(used, allowed, model = "") { setCheck(used, allowed, model); return ex.all_allowed() === 1; },
    violationCount(used, allowed, model = "") { setCheck(used, allowed, model); return ex.violation_count(); },
    // 違反 effect(宣言外で使われたもの)を返す。
    violations(used, allowed, model = "") {
      setCheck(used, allowed, model);
      const s = readOut(ex.violations_resolve());
      return s === "" ? [] : s.split("\n");
    },
  };
}
