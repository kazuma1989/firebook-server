import { EventEmitter } from "events"

export class Store<S = unknown, A extends Action = Action> {
  #state: S
  #emitter = new EventEmitter()

  constructor(reducer: Reducer<S, A>, state: S) {
    this.#state = state

    this.#emitter.on(actionEvent, (action: A) => {
      this.#state = reducer(this.#state, action)
    })
  }

  getState(): S {
    return this.#state
  }

  subscribe(listener: () => void): () => void {
    this.#emitter.on(actionEvent, listener)

    return () => {
      this.#emitter.off(actionEvent, listener)
    }
  }

  dispatch(action: A): void {
    this.#emitter.emit(actionEvent, action)
  }
}

const actionEvent = Symbol("actionEvent")

export interface Reducer<S, A> {
  (state: S, action: A): S
}

export interface Action {
  type: string
  payload?: unknown
}
