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
  route?: MatchedRoute

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
  setup(): void {
    const [mimeType, ...parameters] =
      this.headers["content-type"]?.split(";").map((v) => v.trim()) ?? []

    this.mimeType = mimeType
    this.parameters = parameters
  }

  /**
   * @param routes
   */
  match(routes: Route[]): void {
    const url = new URL(
      path.posix.normalize(this.url!),
      `http://${this.headers.host}`
    )

    for (const [
      ,
      { eventName, method, rawPathPattern, pathPattern },
    ] of routes.entries()) {
      if (this.method !== method) continue

      const match = url.pathname.match(pathPattern)
      if (!match) continue

      this.route = {
        eventName,
        method,
        rawPathPattern,
        pathPattern,
        url,
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

export interface JSONRequest {
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
  "GET",
  "OPTIONS",
  "PATCH",
  "POST",
  "PUT",
] as const

export type METHODS = typeof METHODS[number]

export interface Route {
  /** @example "GET /foo/(?<id>.+)" */
  eventName: `${METHODS} ${string}`

  /** @example "GET" */
  method: METHODS

  /** @example "/foo/(?<id>.+)" */
  rawPathPattern: string

  /** RegExp object which represents `rawPathPattern`. Case insensitive */
  pathPattern: RegExp
}

export interface MatchedRoute extends Route {
  /** Matching URL */
  url: URL

  /** RegExp matching groups for `pathPattern` */
  pathParam: {
    [key: string]: string
  }
}
