import * as assert from "assert"
import { suite } from "uvu"
import { reducer } from "./reducer"

const test = {
  "POST /key": suite("POST /key"),
  "PUT /key/:id": suite("PUT /key/:id"),
  "PATCH /key/:id": suite("PATCH /key/:id"),
  "DELETE /key/:id": suite("DELETE /key/:id"),
}

test["POST /key"]("新規追加できる", async () => {
  const state = {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
    comments: [{ id: "x", value: "X" }],
  }

  const actual = reducer(state, {
    type: "POST /key",
    payload: {
      key: "posts",
      id: "c",
      body: {
        text: "C",
      },
    },
  })

  const expected: typeof state = {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
      { id: "c", text: "C" },
    ],
    comments: [{ id: "x", value: "X" }],
  }

  assert.deepStrictEqual(actual, expected)
})

test["POST /key"]("ボディの id は無視する", async () => {
  const state = {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  }

  const actual = reducer(state, {
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

  const expected: typeof state = {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
      { id: "c", text: "C" },
    ],
  }

  assert.deepStrictEqual(actual, expected)
})

test["PUT /key/:id"]("新規追加できる", async () => {
  const state = {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  }

  const actual = reducer(state, {
    type: "PUT /key/:id",
    payload: {
      key: "posts",
      id: "c",
      body: {
        text: "C",
      },
    },
  })

  const expected: typeof state = {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
      { id: "c", text: "C" },
    ],
  }

  assert.deepStrictEqual(actual, expected)
})

test["PUT /key/:id"]("上書きできる", async () => {
  const state = {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  }

  const actual = reducer(state, {
    type: "PUT /key/:id",
    payload: {
      key: "posts",
      id: "a",
      body: {
        text: "AAA",
      },
    },
  })

  const expected: typeof state = {
    posts: [
      { id: "a", text: "AAA" },
      { id: "b", text: "B" },
    ],
  }

  assert.deepStrictEqual(actual, expected)
})

test["PUT /key/:id"]("ボディの id は無視する", async () => {
  const state = {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  }

  const actual = reducer(state, {
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

  const expected: typeof state = {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
      { id: "c", text: "C" },
    ],
  }

  assert.deepStrictEqual(actual, expected)
})

test["PATCH /key/:id"]("オブジェクトの一部を書き換えられる", async () => {
  const state = {
    posts: [
      { id: "a", text: "A", foo: false },
      { id: "b", text: "B", foo: false },
    ],
  }

  const actual = reducer(state, {
    type: "PATCH /key/:id",
    payload: {
      key: "posts",
      id: "a",
      body: {
        text: "AAA",
      },
    },
  })

  const expected: typeof state = {
    posts: [
      { id: "a", text: "AAA", foo: false },
      { id: "b", text: "B", foo: false },
    ],
  }

  assert.deepStrictEqual(actual, expected)
})

test["PATCH /key/:id"]("id は変えられない", async () => {
  const state = {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  }

  const actual = reducer(state, {
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

  const expected: typeof state = {
    posts: [{ id: "a", text: "A", foo: false } as any, { id: "b", text: "B" }],
  }

  assert.deepStrictEqual(actual, expected)
})

test["PATCH /key/:id"]("存在しない id は無視する", async () => {
  const state = {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  }

  const actual = reducer(state, {
    type: "PATCH /key/:id",
    payload: {
      key: "posts",
      id: "c",
      body: {
        text: "C",
      },
    },
  })

  const expected: typeof state = {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  }

  assert.deepStrictEqual(actual, expected)
})

test["DELETE /key/:id"]("削除できる", async () => {
  const state = {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  }

  const actual = reducer(state, {
    type: "DELETE /key/:id",
    payload: {
      key: "posts",
      id: "a",
    },
  })

  const expected: typeof state = {
    posts: [{ id: "b", text: "B" }],
  }

  assert.deepStrictEqual(actual, expected)
})

test["DELETE /key/:id"]("存在しない id でも大丈夫", async () => {
  const state = {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  }

  const actual = reducer(state, {
    type: "DELETE /key/:id",
    payload: {
      key: "posts",
      id: "c",
    },
  })

  const expected: typeof state = {
    posts: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  }

  assert.deepStrictEqual(actual, expected)
})

Object.values(test).forEach((t) => t.run())
