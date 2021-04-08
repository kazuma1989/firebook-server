export interface DB extends Record<string, Entry[]> {}

interface Entry {
  id: string
  [key: string]: unknown
}

type RestAction =
  | {
      type: "POST /key"
      payload: {
        key: string
        id: string
        body: {
          [key: string]: unknown
        }
      }
    }
  | {
      type: "PUT /key/:id"
      payload: {
        key: string
        id: string
        body: {
          [key: string]: unknown
        }
      }
    }
  | {
      type: "PATCH /key/:id"
      payload: {
        key: string
        id: string
        body: {
          [key: string]: unknown
        }
      }
    }
  | {
      type: "DELETE /key/:id"
      payload: {
        key: string
        id: string
      }
    }

export function reducer(state: DB, action: RestAction): DB {
  switch (action.type) {
    case "POST /key":
    case "PUT /key/:id": {
      const { key, id, body } = action.payload
      const items = state[key] ?? []

      const newItem = { ...body, id }

      let index = items.findIndex((p) => p.id === newItem.id) ?? -1
      if (index === -1) {
        // 見つからなかったら末尾に追加する。
        index = items.length
      }

      return {
        ...state,
        [key]: [...items.slice(0, index), newItem, ...items.slice(index + 1)],
      }
    }

    case "PATCH /key/:id": {
      const { key, id, body } = action.payload
      const items = state[key]

      if (!items) {
        return state
      }

      return {
        ...state,
        [key]: items.map((p) => {
          if (p.id !== id) {
            return p
          }

          return {
            ...p,
            ...body,
            id,
          }
        }),
      }
    }

    case "DELETE /key/:id": {
      const { key, id } = action.payload
      const items = state[key]

      if (!items) {
        return state
      }

      return {
        ...state,
        [key]: items.filter((p) => p.id !== id),
      }
    }

    default: {
      return state
    }
  }
}
