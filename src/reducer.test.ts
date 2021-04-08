import * as assert from "assert"
import { suite } from "uvu"
import { reducer } from "./reducer"
import { Store } from "./store"

const test = {
  "POST /post": suite("POST /post"),
  "PUT /post/:id": suite("PUT /post/:id"),
  "DELETE /post/:id": suite("DELETE /post/:id"),
}

test["POST /post"]("新規追加できる", async () => {
  const store = new Store(reducer, {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  })

  store.dispatch({
    type: "POST /post",
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

test["POST /post"]("ボディの id は無視する", async () => {
  const store = new Store(reducer, {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  })

  store.dispatch({
    type: "POST /post",
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

test["DELETE /post/:id"]("削除できる", async () => {
  const store = new Store(reducer, {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  })

  store.dispatch({
    type: "DELETE /post",
    payload: {
      id: "a",
    },
  })

  assert.deepStrictEqual(store.getState(), {
    posts: [{ id: "b", text: "B" }],
  })
})

test["DELETE /post/:id"]("存在しない id でも大丈夫", async () => {
  const store = new Store(reducer, {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  })

  store.dispatch({
    type: "DELETE /post",
    payload: {
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
