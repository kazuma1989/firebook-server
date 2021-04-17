interface Tables extends Record<string, Item[]> {}

interface Item {
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

export function reducer(state: Tables, action: RestAction): Tables {
  switch (action.type) {
    case "POST /key": {
      const { key, id, body } = action.payload
      const items = state[key] ?? []

      const newItem = { ...body, id }

      // 同一 ID があったらスキップする。
      if (items.some((p) => p.id === newItem.id)) {
        return state
      }

      return {
        ...state,
        [key]: [...items, newItem],
      }
    }

    case "PUT /key/:id": {
      const { key, id, body } = action.payload
      const items = state[key] ?? []

      const newItem = { ...body, id }

      let index = items.findIndex((p) => p.id === newItem.id)
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
      const _: never = action
      return state
    }
  }
}
