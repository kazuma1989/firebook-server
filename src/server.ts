import * as http from "http"

const METHODS = ["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"] as const
type METHODS = typeof METHODS[number]

interface Route {
  /** @example `/foo/bar` */
  path: string

  /** Alias for `path` */
  url: string

  /** @example `GET /foo/(?<id>.+)` */
  eventName: `${METHODS} ${string}`

  /** @example `GET` */
  method: METHODS

  /** @example `/foo/(?<id>.+)` */
  rawPathPattern: string

  /** RegExp object which represents `rawPathPattern`. Case insensitive */
  pathPattern: RegExp

  /** RegExp matching groups for `pathPattern` */
  pathParam: {
    [key: string]: string
  }
}

interface Server extends http.Server {
  on(
    event: `${METHODS} ${string}`,
    listener: (
      req: http.IncomingMessage,
      resp: http.ServerResponse,
      route: Route
    ) => void
  ): this

  on(
    event: "request",
    listener: (req: http.IncomingMessage, resp: http.ServerResponse) => void
  ): this

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
  const server: Server = http.createServer()

  server.once("listening", function setup(this: http.Server) {
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
      let route: Route | undefined
      for (let i = 0; i < routes.length; i++) {
        const { eventName, method, rawPathPattern, pathPattern } = routes[i]!
        if (req.method !== method) continue

        const match = req.url?.match(pathPattern)
        if (!match) continue

        route = {
          path: match[0]!,
          url: match[0]!,
          eventName,
          method,
          rawPathPattern,
          pathPattern,
          pathParam: match.groups ?? {},
        }
        break
      }

      if (!route) {
        resp.writeHead(404)
        resp.end()

        return
      }

      this.emit(route.eventName, req, resp, route)
    })
  })

  return server
}
