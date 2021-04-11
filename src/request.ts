import * as http from "http"
import * as path from "path"

/**
 */
export class Request extends http.IncomingMessage {
  readonly method: string
  readonly url: string

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

    this.method = super.method!
    this.url = super.url!
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

    this.normalizedURL = new URL(
      path.posix.normalize(this.url),
      `http://${this.headers.host}`
    )
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

  on(event: "warn", listener: (info: JSONRequestWarnInfo) => void): this
  on(event: string, listener: (...args: unknown[]) => void): this
  on(event: string, listener: (...args: any[]) => void): this
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener)
  }

  private warn(info: JSONRequestWarnInfo) {
    this.emit("warn", info)
  }
}

type JSONRequestWarnInfo = {
  type: "warn/chunk-is-not-a-buffer"
  message: string
  payload?: unknown
}

export interface Route {
  /** @example "GET /foo/(?<id>.+)" */
  eventName: string

  /** @example "GET" */
  method: string

  /** @example RegExp("^/foo/(?<id>.+)$", "i") */
  pathPattern: RegExp
}

export interface MatchingRoute extends Route {
  /** RegExp matching groups for `pathPattern` */
  pathParam: {
    [key: string]: string
  }
}
