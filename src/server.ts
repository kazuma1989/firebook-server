import * as http from "http"
import { JSONRequest, Route } from "./request"
import { JSONResponse } from "./response"
import { nonNullable } from "./util"

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
  return http
    .createServer({
      IncomingMessage: JSONRequest,
      ServerResponse: JSONResponse,
    })
    .once("listening", function setup(this: Server) {
      const routes: Route[] = this.eventNames()
        .map((eventName) => {
          if (typeof eventName !== "string") return

          const [method, rawPathPattern] = eventName.split(" ", 2)
          if (!method || !METHODS.includes(method as any) || !rawPathPattern)
            return

          return {
            eventName,
            method,
            pathPattern: new RegExp(`^${rawPathPattern}$`, "i"),
          }
        })
        .filter(nonNullable)

      this.on("request", (req, resp) => {
        try {
          if (!METHODS.includes(req.method as any)) {
            resp.writeStatus("405 Method Not Allowed").end()
            return
          }

          try {
            req.setup()
          } catch (err: unknown) {
            if ((err as any).code === "ERR_INVALID_URL") {
              resp.writeStatus("400 Invalid Host header").end()
              return
            }

            throw err
          }

          req.match(routes)

          if (!req.route) {
            resp.writeStatus("404 Not Found").end()
            return
          }

          this.emit(req.route.eventName, req, resp)
        } catch (err: unknown) {
          console.error(err)

          resp.writeStatus("500 Internal Server Error").end()
          return
        }
      })
    })
}

type RoutingEvent = `${METHODS} ${string}`

interface Server extends BaseServer<JSONRequest, JSONResponse, RoutingEvent> {}

interface BaseServer<
  ReqType extends http.IncomingMessage = http.IncomingMessage,
  RespType extends http.ServerResponse = http.ServerResponse,
  EventType extends string = string
> extends http.Server {
  on(event: "request", listener: (req: ReqType, resp: RespType) => void): this

  on(event: EventType, listener: (req: ReqType, resp: RespType) => void): this

  /** @deprecated avoid type ambiguity */
  on(event: string, listener: (...args: unknown[]) => void): this
  /** @deprecated avoid type ambiguity */
  on(event: string, listener: (...args: any[]) => void): this
}

const METHODS = [
  "DELETE",
  "HEAD",
  "GET",
  "OPTIONS",
  "PATCH",
  "POST",
  "PUT",
] as const

type METHODS = typeof METHODS[number]
