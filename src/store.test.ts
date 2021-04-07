import * as assert from "assert"
import { EventEmitter } from "events"
import { test } from "uvu"

interface Reducer<State, Action> {
  (state: State, action: Action): State
}

class Store<State = any, Action = any> {
  private emitter = new EventEmitter()

  constructor(reducer: Reducer<State, Action>, private state: State) {
    this.emitter.on("action", (action: Action) => {
      this.state = reducer(this.state, action)
    })
  }

  getState(): State {
    return this.state
  }

  subscribe(listener: () => void): () => void {
    this.emitter.on("action", listener)

    return () => {
      this.emitter.off("action", listener)
    }
  }

  dispatch(action: Action): void {
    this.emitter.emit("action", action)
  }
}

interface Entry {
  id: string
  [key: string]: unknown
}

interface DB extends Record<string, Entry[]> {}

type RestAction = {
  type: "PUT /post/:id"
  payload: {
    id: string
    body: {
      [key: string]: unknown
    }
  }
}

function reducer(state: DB, action: RestAction): DB {
  switch (action.type) {
    case "PUT /post/:id": {
      const { id, body } = action.payload

      return {
        ...state,
        posts: [
          ...(state.posts ?? []),
          {
            ...body,
            id,
          },
        ],
      }
    }
  }
}

test("PUT /post/:id", async () => {
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

test.run()
