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

export function reducer(state: DB, action: RestAction): DB {
  switch (action.type) {
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
  }
}
