import * as assert from "assert"
import { suite } from "uvu"
import { reducer } from "./reducer"
import { Store } from "./store"

const test = {
  "POST /key": suite("POST /key"),
  "PUT /key/:id": suite("PUT /key/:id"),
  "PATCH /key/:id": suite("PATCH /key/:id"),
  "DELETE /key/:id": suite("DELETE /key/:id"),
}

test["POST /key"]("新規追加できる", async () => {
  const store = new Store(reducer, {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
    comments: [{ id: "x", value: "X" }],
  })

  store.dispatch({
    type: "POST /key",
    payload: {
      key: "posts",
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
    comments: [{ id: "x", value: "X" }],
  })
})

test["POST /key"]("ボディの id は無視する", async () => {
  const store = new Store(reducer, {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  })

  store.dispatch({
    type: "POST /key",
    payload: {
      key: "posts",
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

test["PUT /key/:id"]("新規追加できる", async () => {
  const store = new Store(reducer, {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  })

  store.dispatch({
    type: "PUT /key/:id",
    payload: {
      key: "posts",
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

test["PUT /key/:id"]("上書きできる", async () => {
  const store = new Store(reducer, {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  })

  store.dispatch({
    type: "PUT /key/:id",
    payload: {
      key: "posts",
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

test["PUT /key/:id"]("ボディの id は無視する", async () => {
  const store = new Store(reducer, {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  })

  store.dispatch({
    type: "PUT /key/:id",
    payload: {
      key: "posts",
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

test["PATCH /key/:id"]("オブジェクトの一部を書き換えられる", async () => {
  const store = new Store(reducer, {
    posts: [
      { id: "a", text: "A", foo: false },
      { id: "b", text: "B", foo: false },
    ],
  })

  store.dispatch({
    type: "PATCH /key/:id",
    payload: {
      key: "posts",
      id: "a",
      body: {
        text: "AAA",
      },
    },
  })

  assert.deepStrictEqual(store.getState(), {
    posts: [
      { id: "a", text: "AAA", foo: false },
      { id: "b", text: "B", foo: false },
    ],
  })
})

test["PATCH /key/:id"]("id は変えられない", async () => {
  const store = new Store(reducer, {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  })

  store.dispatch({
    type: "PATCH /key/:id",
    payload: {
      key: "posts",
      id: "a",
      body: {
        id: "d",
        foo: false,
      },
    },
  })

  assert.deepStrictEqual(store.getState(), {
    posts: [
      { id: "a", text: "A", foo: false },
      { id: "b", text: "B" },
    ],
  })
})

test["PATCH /key/:id"]("存在しない id は無視する", async () => {
  const store = new Store(reducer, {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  })

  store.dispatch({
    type: "PATCH /key/:id",
    payload: {
      key: "posts",
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
    ],
  })
})

test["DELETE /key/:id"]("削除できる", async () => {
  const store = new Store(reducer, {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  })

  store.dispatch({
    type: "DELETE /key/:id",
    payload: {
      key: "posts",
      id: "a",
    },
  })

  assert.deepStrictEqual(store.getState(), {
    posts: [{ id: "b", text: "B" }],
  })
})

test["DELETE /key/:id"]("存在しない id でも大丈夫", async () => {
  const store = new Store(reducer, {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  })

  store.dispatch({
    type: "DELETE /key/:id",
    payload: {
      key: "posts",
      id: "c",
    },
  })

  assert.deepStrictEqual(store.getState(), {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  })
})

Object.values(test).forEach((t) => t.run())
