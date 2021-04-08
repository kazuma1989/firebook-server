import * as assert from "assert"
import { test } from "uvu"
import { Action, Store } from "./store"

function reducer(state: number, action: Action): number {
  return state + 1
}

test("subscribe できる", async () => {
  const store = new Store(reducer, 0)

  let called = false
  store.subscribe(() => {
    called = true
  })

  store.dispatch({ type: "" })

  assert.ok(called, "リスナーが呼ばれていない")
})

test("unsubscribe できる", async () => {
  const store = new Store(reducer, 0)

  let called = false
  const unsubscribe = store.subscribe(() => {
    called = true
  })

  unsubscribe()

  store.dispatch({ type: "" })

  assert.ok(!called, "リスナーが呼ばれてしまった")
})

test("unsubscribe で間違って全部のリスナーを解除しない", async () => {
  const store = new Store(reducer, 0)

  let called1 = false
  const unsubscribe1 = store.subscribe(() => {
    called1 = true
  })

  let called2 = false
  store.subscribe(() => {
    called2 = true
  })

  unsubscribe1()

  store.dispatch({ type: "" })

  assert.ok(!called1, "リスナーが呼ばれてしまった")
  assert.ok(called2, "リスナーが呼ばれていない")
})

test("リスナーの呼び出しは reducer 実行後", async () => {
  const store = new Store(reducer, 0)

  let state = store.getState()
  store.subscribe(() => {
    // reducer -> listener の順であれば
    // state が +1 された状態になっているはず。
    state = store.getState()
  })

  store.dispatch({ type: "" })

  assert.strictEqual(state, 1)
})

test.run()
