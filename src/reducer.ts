interface Entry {
  id: string
  [key: string]: unknown
}

interface DB extends Record<string, Entry[]> {}

type RestAction =
  | {
      type: "POST /post"
      payload: {
        id: string
        body: {
          [key: string]: unknown
        }
      }
    }
  | {
      type: "PUT /post/:id"
      payload: {
        id: string
        body: {
          [key: string]: unknown
        }
      }
    }
  | {
      type: "PATCH /post/:id"
      payload: {
        id: string
        body: {
          [key: string]: unknown
        }
      }
    }
  | {
      type: "DELETE /post"
      payload: {
        id: string
      }
    }

export function reducer(state: DB, action: RestAction): DB {
  switch (action.type) {
    case "POST /post":
    case "PUT /post/:id": {
      const { posts = [] } = state
      const { id, body } = action.payload

      const newPost = { ...body, id }

      let index = posts.findIndex((p) => p.id === newPost.id) ?? -1
      if (index === -1) {
        // 見つからなかったら末尾に追加する。
        index = posts.length
      }

      return {
        ...state,
        posts: [...posts.slice(0, index), newPost, ...posts.slice(index + 1)],
      }
    }

    case "PATCH /post/:id": {
      const { posts } = state
      const { id, body } = action.payload

      if (!posts) {
        return state
      }

      return {
        ...state,
        posts: posts.map((p) => {
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

    case "DELETE /post": {
      const { posts } = state
      const { id } = action.payload

      if (!posts) {
        return state
      }

      return {
        ...state,
        posts: posts.filter((p) => p.id !== id),
      }
    }

    default: {
      return state
    }
  }
}
