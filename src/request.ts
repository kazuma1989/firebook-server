import * as http from "http"
import * as path from "path"

/**
 */
export class JSONRequest extends http.IncomingMessage {
  /** @example "application/json" */
  mimeType?: string

  /** @example ["charset=utf-8"] */
  parameters?: string[]

  /** it will be set after `match()` call */
  route?: MatchingRoute

  /** */
  normalizedURL?: URL

  /**
   */
  constructor(socket: import("net").Socket) {
    super(socket)
  }

  /**
   * ヘッダーを簡易的にパースするので、Content-Type ヘッダーに quoted-string があると予期せぬ動作になる。
   *
   * e.g.)
   * ```
   * Content-Type: text/plain; param="a;b"
   * // mimeType = "text/plain"
   * // parameters = ["param=\"a", "b\""]
   * ```
   */
  setup(): boolean {
    const [mimeType, ...parameters] =
      this.headers["content-type"]?.split(";").map((v) => v.trim()) ?? []

    this.mimeType = mimeType
    this.parameters = parameters

    this.normalizedURL = new URL(
      path.posix.normalize(this.url),
      `http://${this.headers.host}`
    )

    if (!METHODS.includes(this.method)) {
      return false
    }

    return true
  }

  /**
   * @param routes
   */
  match(routes: Route[]): void {
    for (const [, { eventName, method, pathPattern }] of routes.entries()) {
      if (this.method !== method) continue

      const match = this.normalizedURL?.pathname.match(pathPattern)
      if (!match) continue

      this.route = {
        eventName,
        method,
        pathPattern,
        pathParam: match.groups ?? {},
      }
      break
    }
  }

  /**
   * JSON としてリクエストボディをパースする。
   */
  async parseBodyAsJSONObject(): Promise<{
    [key: string]: unknown
  }> {
    const chunks: Buffer[] = []
    for await (const chunk of this) {
      if (!(chunk instanceof Buffer)) {
        this.warn({
          type: "warn/chunk-is-not-a-buffer",
          message: "chunk is not a buffer",
          payload: chunk,
        })
        break
      }

      chunks.push(chunk)
    }

    const body = Buffer.concat(chunks).toString()

    return {
      ...JSON.parse(body),
    }
  }

  private warn(info: JSONRequestWarnInfo) {
    this.emit("warn", info)
  }
}

export interface JSONRequest extends http.IncomingMessage {
  method: METHODS
  url: string

  on(event: "warn", listener: (info: JSONRequestWarnInfo) => void): this

  /** @deprecated avoid type ambiguity */
  on(event: string, listener: (...args: unknown[]) => void): this
  /** @deprecated avoid type ambiguity */
  on(event: string, listener: (...args: any[]) => void): this
}

type JSONRequestWarnInfo = {
  type: "warn/chunk-is-not-a-buffer"
  message: string
  payload?: unknown
}

export const METHODS = [
  "DELETE",
  "HEAD",
  "GET",
  "OPTIONS",
  "PATCH",
  "POST",
  "PUT",
] as const

export type METHODS = typeof METHODS[number]

export interface Route {
  /** @example "GET /foo/(?<id>.+)" */
  eventName: string

  /** @example "GET" */
  method: string

  /** RegExp object which represents `eventName`. Case insensitive */
  pathPattern: RegExp
}

export interface MatchingRoute extends Route {
  /** @example "GET" */
  method: METHODS

  /** RegExp matching groups for `pathPattern` */
  pathParam: {
    [key: string]: string
  }
}
