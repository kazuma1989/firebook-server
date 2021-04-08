import * as assert from "assert"
import { suite } from "uvu"
import { reducer } from "./reducer"
import { Store } from "./store"

const test = {
  "PUT /post/:id": suite("PUT /post/:id"),
}

test["PUT /post/:id"]("新規追加できる", async () => {
  const store = new Store(reducer, {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  })

  store.dispatch({
    type: "PUT /post/:id",
    payload: {
      id: "c",
      body: {
        text: "C",
      },
    },
  })

  assert.deepStrictEqual(store.getState(), {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
      { id: "c", text: "C" },
    ],
  })
})

test["PUT /post/:id"]("上書きできる", async () => {
  const store = new Store(reducer, {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  })

  store.dispatch({
    type: "PUT /post/:id",
    payload: {
      id: "a",
      body: {
        text: "AAA",
      },
    },
  })

  assert.deepStrictEqual(store.getState(), {
    posts: [
      { id: "a", text: "AAA" },
      { id: "b", text: "B" },
    ],
  })
})

test["PUT /post/:id"]("ボディの id は無視する", async () => {
  const store = new Store(reducer, {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  })

  store.dispatch({
    type: "PUT /post/:id",
    payload: {
      id: "c",
      body: {
        id: "a",
        text: "C",
      },
    },
  })

  assert.deepStrictEqual(store.getState(), {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
      { id: "c", text: "C" },
    ],
  })
})

Object.values(test).forEach((t) => t.run())
