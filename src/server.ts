import * as http from "http"
import { Request } from "./request"
import { Response } from "./response"
import { debuglog } from "./util"

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
export interface Server {
  // newListener / removeListener
  on(
    event: "newListener" | "removeListener",
    listener: (event: string, listener: (...args: any[]) => void) => void
  ): () => void
  off(
    event: "newListener" | "removeListener",
    listener: (event: string, listener: (...args: any[]) => void) => void
  ): () => void

  // request
  on(event: "request", listener: (req: Request, resp: Response) => void): this
  off(event: "request", listener: (req: Request, resp: Response) => void): this

  // routing events
  on(
    event: RoutingEvent,
    listener: (req: Request, resp: Response) => void
  ): this
  off(
    event: RoutingEvent,
    listener: (req: Request, resp: Response) => void
  ): this
  emit(event: RoutingEvent, req: Request, resp: Response): boolean

  // undefined events
  on(event: never, listener: (...args: any[]) => void): this
  once(event: never, listener: (...args: any[]) => void): this
  off(event: never, listener: (...args: any[]) => void): this
  emit(event: never, ...args: any[]): boolean
}

export class Server extends http.Server {
  constructor() {
    super({
      IncomingMessage: Request,
      ServerResponse: Response,
    })

    this.setMaxListeners(1_000)

    this.on("request", (req, resp) => {
      if (!(METHODS as readonly string[]).includes(req.method)) {
        resp.writeStatus("405 Method Not Allowed").end()
        return
      }

      try {
        req.emit("setup")
      } catch (err: unknown) {
        if ((err as any).code === "ERR_INVALID_URL") {
          resp.writeStatus("400 Invalid Host header").end()
          return
        }

        throw err
      }
    })

    let totalRoutes = 0
    const skippedRoutes = new WeakMap<Response, number>()

    this.on("newListener", (eventName, listener) => {
      const method = METHODS.find((m) => eventName.startsWith(`${m} `))
      if (!method) return

      const routeName = eventName as `${METHODS} ${string}`

      let pathPattern: RegExp
      try {
        // GET /assets/(?<file>.+) -> new RegExp("^/assets/(?<file>.+)$", "i")
        pathPattern = new RegExp(`^${routeName.slice(method.length + 1)}$`, "i")
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error("WARN", error.message)
        }

        console.error("failed to install", routeName)
        return
      }

      debuglog("installing route:", routeName)

      const onRoute = (req: Request, resp: Response): void => {
        if (resp.headersSent || resp.finished) {
          debuglog("headers sent or response finished")
          return
        }

        if (req.method === method) {
          const match = req.normalizedURL?.pathname.match(pathPattern)

          if (match) {
            req.route = {
              eventName: routeName,
              method,
              pathPattern,
              pathParam: match.groups ?? {},
            }

            this.emit(routeName, req, resp)
            return
          }
        }

        // マッチしなかったらカウントを増やす。
        // リスナー総数と同じになったらそれは 404 を意味する。
        skippedRoutes.set(resp, (skippedRoutes.get(resp) ?? 0) + 1)
        if (skippedRoutes.get(resp)! >= totalRoutes) {
          resp.writeStatus("404 Not Found").end()
        }
      }
      this.on("request", onRoute)
      totalRoutes += 1

      const onRemoveListener = (
        _eventName: string,
        _listener: (...args: any[]) => void
      ) => {
        if (_eventName !== eventName) return
        if (_listener !== listener) return

        debuglog("uninstalling route:", _eventName)

        this.off("request", onRoute)
        totalRoutes -= 1

        this.off("removeListener", onRemoveListener)
      }
      this.on("removeListener", onRemoveListener)
    })

    // エラーをキャッチし損ねたときもハングアップせずに 500 Internal Server Error で応答する。
    this.on("request", (req, resp) => {
      const uncaughtException: NodeJS.UncaughtExceptionListener &
        NodeJS.UnhandledRejectionListener = (error: unknown) => {
        try {
          console.error("UNCAUGHT", error)

          if (resp.headersSent || resp.finished) {
            debuglog("headers sent or response finished")
          } else {
            resp.writeStatus("500 Internal Server Error")
          }
        } catch (error: unknown) {
          console.error(error)
        } finally {
          // this emits "finish" event and it will remove listeners.
          resp.end()
        }
      }

      process.once("uncaughtException", uncaughtException)
      process.once("unhandledRejection", uncaughtException)

      resp.once("finish", () => {
        debuglog("removing uncaughtException and unhandledRejection listeners")

        process.off("uncaughtException", uncaughtException)
        process.off("unhandledRejection", uncaughtException)
      })
    })
  }
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
