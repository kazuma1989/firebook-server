import * as http from "http"
import * as path from "path"
import { URL } from "url"

const METHODS = ["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"] as const
type METHODS = typeof METHODS[number]

interface Route {
  /** @example `GET /foo/(?<id>.+)` */
  eventName: `${METHODS} ${string}`

  /** @example `GET` */
  method: METHODS

  /** @example `/foo/(?<id>.+)` */
  rawPathPattern: string

  /** RegExp object which represents `rawPathPattern`. Case insensitive */
  pathPattern: RegExp

  /** Matching URL */
  url: URL

  /** RegExp matching groups for `pathPattern` */
  pathParam: {
    [key: string]: string
  }
}

interface Server extends http.Server {
  on(
    event: "request",
    listener: (req: http.IncomingMessage, resp: http.ServerResponse) => void
  ): this

  on<Event extends `${METHODS} ${string}`>(
    event: Event,
    listener: (
      req: http.IncomingMessage,
      resp: http.ServerResponse,
      route: Route
    ) => void
  ): this

  on(event: string, listener: (...args: unknown[]) => void): this

  on(event: string, listener: (...args: any[]) => void): this
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
export function createServer(): Server {
  class JSONResponse extends http.ServerResponse {
    constructor(req: http.IncomingMessage) {
      super(req)

      this.setHeader("Content-Type", "application/json")
    }
  }

  return http
    .createServer({
      IncomingMessage: http.IncomingMessage,
      ServerResponse: JSONResponse,
    })
    .once("listening", function setup(this: Server) {
      const routes = this.eventNames()
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
        const notFound = () => {
          resp.writeHead(404)
          resp.end()
        }

        const badRequest = () => {
          resp.writeHead(400)
          resp.end()
        }

        if (!req.method || !req.url) {
          badRequest()
          return
        }

        const normalized = {
          method: req.method?.toUpperCase(),
          url: path.posix.normalize(req.url),
        }

        let route: Route | undefined
        for (let i = 0; i < routes.length; i++) {
          const { eventName, method, rawPathPattern, pathPattern } = routes[i]!
          if (normalized.method !== method) continue

          let url: URL
          try {
            url = new URL(normalized.url, `http://${req.headers.host}`)
          } catch (err) {
            badRequest()
            return
          }

          const match = url.pathname.match(pathPattern)
          if (!match) continue

          route = {
            eventName,
            method,
            rawPathPattern,
            pathPattern,
            url,
            pathParam: match.groups ?? {},
          }
          break
        }

        if (!route) {
          notFound()
          return
        }

        this.emit(route.eventName, req, resp, route)
      })
    })
}
