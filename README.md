# fizz-effect-checker

kotodama の **effect 静的検証**。Almide 1 コアを native + wasm へ。
openaituber `kotodama`(famulus_core `Effect`/`EffectSet`)の許可検証を切り出した単一責任部品(§10)。

応答計画が使う effect 集合が、persona の `spec.json` `effects.allowed`(+ 実行時に足される
`llm.<model>`)の**許可集合に収まっているか**を検証する(used ⊆ allowed)。

> effect の**実行**(LLM 呼び出し等)は runtime = host の責務。ここは許可集合との包含検証のみ。

effect は `"namespace.action"` 形式(例 `llm.invoke` / `llm.haiku`)。

## API

| 関数 | 説明 |
|---|---|
| `namespace(eff)` / `action(eff)` | `"."` で分割した前半 / 後半 |
| `is_valid_effect(eff)` | namespace と action がともに非空か |
| `is_allowed(eff, allowed)` | 単一 effect が許可集合に含まれるか |
| `with_model(allowed, model)` | `allowed ∪ {llm.<model>}`(eval.rs:174 の runtime 許可、重複は付けない) |
| `all_allowed(used, allowed)` | `used ⊆ allowed` か(空 used は常に true) |
| `violations(used, allowed)` | 許可外で使われた effect(初出順・重複排除) |
| `violation_count(used, allowed)` | 違反 effect の数 |

## wasm 境界

host がバッファに書く: 単一 effect / used(改行区切り)/ allowed(改行区切り)/ model。
`model` を渡すと許可集合に `llm.<model>` が足される。各バッファは `from_list(to_list)`
コピー経由で文字列化(almide#690 回避)。違反 effect 列・namespace/action は `out_ptr` で読む。
例: [`browser/effect-driver.js`](browser/effect-driver.js)。

## ビルド / テスト

```sh
almide test spec/effect_checker_test.almd
almide build src/main.almd -o build/fizz-effect-checker
almide build src/bridge.almd --target wasm -o build/ec.wasm
node test/wasm-smoke.mjs
```

Almide v0.27.7 で native / wasm とも green。
