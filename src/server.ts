import * as http from "http"
import * as path from "path"

const METHODS = ["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"] as const
type METHODS = typeof METHODS[number]

interface Route {
  /** @example "GET /foo/(?<id>.+)" */
  eventName: `${METHODS} ${string}`

  /** @example "GET" */
  method: METHODS

  /** @example "/foo/(?<id>.+)" */
  rawPathPattern: string

  /** RegExp object which represents `rawPathPattern`. Case insensitive */
  pathPattern: RegExp
}

interface MatchedRoute extends Route {
  /** Matching URL */
  url: URL

  /** RegExp matching groups for `pathPattern` */
  pathParam: {
    [key: string]: string
  }
}

interface Server<
  ReqType extends http.IncomingMessage = http.IncomingMessage,
  RespType extends http.ServerResponse = http.ServerResponse
> extends http.Server {
  on(event: "request", listener: (req: ReqType, resp: RespType) => void): this

  on<Event extends `${METHODS} ${string}`>(
    event: Event,
    listener: (req: ReqType, resp: RespType) => void
  ): this

  /** @deprecated avoid type ambiguity */
  on(event: string, listener: (...args: unknown[]) => void): this
  /** @deprecated avoid type ambiguity */
  on(event: string, listener: (...args: any[]) => void): this
}

/**
 */
class JSONRequest extends http.IncomingMessage {
  /** @example "application/json" */
  mimeType?: string

  /** @example ["charset=utf-8"] */
  parameters?: string[]

  /** it will be set after `match()` call */
  route?: MatchedRoute

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

interface JSONRequest {
  on(event: "warn", listener: (info: JSONRequestWarnInfo) => void): this

  /** @deprecated avoid type ambiguity */
  on(event: string, listener: (...args: unknown[]) => void): this
  /** @deprecated avoid type ambiguity */
  on(event: string, listener: (...args: any[]) => void): this
}

interface JSONRequestWarnInfo {
  type: "warn/chunk-is-not-a-buffer"
  message: string
  payload?: unknown
}

/**
 * Content-Type のデフォルト値が application/json
 */
class JSONResponse extends http.ServerResponse {
  constructor(req: http.IncomingMessage) {
    super(req)

    this.setHeader("Content-Type", "application/json")
  }

  /**
   * `null` という文字列（JSON として解釈可能）を返す。
   *
   * @param status
   * @param message デフォルト以外のステータスメッセージにしたいときは指定する。
   */
  endAs(
    status:
      | "200 OK"
      | "400 Bad Request"
      | "404 Not Found"
      | "405 Method Not Allowed"
      | "503 Service Unavailable",
    message?: string
  ): void {
    const statusCode = parseInt(status.split(" ")[0]!) || 500

    if (message) {
      this.statusMessage = message
    }

    this.writeHead(statusCode, { "Content-Type": "application/json" })
    this.end("null")
  }
}

/**
 * @example
 * const server = createServer()
 *
 * server.on("request", (req, resp) => {
 *   console.log("request", req.url)
 * })
 *
 * server.on("GET /users/(?<id>.+)", (req, resp, { pathParam: { id } }) => {
 *   resp.end(id)
 * })
 *
 * server.listen(port, host, () => {
 *   console.log(`Server is listening at http://${host}:${port}`)
 * })
 */
export function createServer(): Server<JSONRequest, JSONResponse> {
  return http
    .createServer({
      IncomingMessage: JSONRequest,
      ServerResponse: JSONResponse,
    })
    .once("listening", function setup(this: Server<JSONRequest, JSONResponse>) {
      const routes: Route[] = this.eventNames()
        .filter(
          (eventName): eventName is `${METHODS} ${string}` =>
            typeof eventName === "string" &&
            METHODS.some((method) => eventName.startsWith(`${method} `))
        )
        .map((eventName) => {
          const [method, rawPathPattern] = eventName.split(" ", 2) as [
            METHODS,
            string
          ]

          return {
            eventName,
            method,
            rawPathPattern,
            pathPattern: new RegExp(`^${rawPathPattern}$`, "i"),
          }
        })

      this.on("request", (req, resp) => {
        try {
          req.setup()

          try {
            req.match(routes)
          } catch (err: unknown) {
            if ((err as any).code !== "ERR_INVALID_URL") {
              throw err
            }

            resp.endAs("400 Bad Request")
            return
          }

          if (!req.route) {
            resp.endAs("404 Not Found")
            return
          }

          this.emit(req.route.eventName, req, resp)
        } catch (err: unknown) {
          console.error(err)

          resp.endAs("503 Service Unavailable")
        }
      })
    })
}
