import * as http from "http"
import { JSONRequest, Route } from "./request"
import { JSONResponse } from "./response"
import { nonNullable } from "./util"

/**
 * @example
 * const server = new Server()
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
export class Server extends http.Server {
  constructor() {
    super({
      IncomingMessage: JSONRequest,
      ServerResponse: JSONResponse,
    })

    this.once("listening", () => {
      const routes: Route[] = this.eventNames()
        .map((eventName) => {
          if (typeof eventName !== "string") return

          const method = METHODS.find((m) => eventName.startsWith(`${m} `))
          if (!method) return

          return {
            eventName: eventName as `${METHODS} ${string}`,
            method,
            pathPattern: new RegExp(
              `^${eventName.slice(method.length + 1)}$`,
              "i"
            ),
          }
        })
        .filter(nonNullable)

      this.on("request", (req, resp) => {
        if (resp.headersSent || resp.finished) return

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

          this.emit(req.route.eventName as RoutingEvent, req, resp)
        } catch (err: unknown) {
          console.error(err)

          resp.writeStatus("500 Internal Server Error").end()
          return
        }
      })
    })
  }
}

export interface Server extends http.Server {
  on(
    event: "request",
    listener: (req: JSONRequest, resp: JSONResponse) => void
  ): this

  on(
    event: RoutingEvent,
    listener: (req: JSONRequest, resp: JSONResponse) => void
  ): this

  /** @deprecated avoid type ambiguity */
  on(event: string, listener: (...args: unknown[]) => void): this
  /** @deprecated avoid type ambiguity */
  on(event: string, listener: (...args: any[]) => void): this

  emit(event: RoutingEvent, req: JSONRequest, resp: JSONResponse): boolean

  /** @deprecated avoid type ambiguity */
  emit(event: string | symbol, ...args: any[]): boolean
}

type RoutingEvent = `${METHODS} ${string}`

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
