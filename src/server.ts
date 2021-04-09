import * as http from "http"
import { JSONRequest, METHODS, Route } from "./request"
import { JSONResponse } from "./response"

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
