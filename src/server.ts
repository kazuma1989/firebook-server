import * as http from "http"
import { Request, Route } from "./request"
import { Response } from "./response"
import { debuglog, nonNullable } from "./util"

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
      IncomingMessage: Request,
      ServerResponse: Response,
    })

    this.once("listening", () => {
      const routes = this.routes()

      this.on("request", (req, resp) => {
        if (resp.headersSent || resp.finished) {
          debuglog("headers sent or response finished")
          return
        }

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

          this._emit(req.route.eventName as RoutingEvent, req, resp)
        } catch (err: unknown) {
          console.error(err)

          resp.writeStatus("500 Internal Server Error").end()
          return
        }
      })
    })

    // エラーをキャッチし損ねたときもハングアップせずに 500 Internal Server Error で応答する。
    this.on("request", (req, resp) => {
      const uncaughtException: NodeJS.UncaughtExceptionListener &
        NodeJS.UnhandledRejectionListener = (error: unknown) => {
        try {
          console.error("UNCAUGHT", error)

          resp.writeStatus("500 Internal Server Error")
        } catch (error: unknown) {
          console.error(error)
        } finally {
          // this emits "finish" event and it will remove listeners.
          resp.end()
        }
      }

      process.once("uncaughtException", uncaughtException)
      process.once("unhandledRejection", uncaughtException)

      resp.on("finish", () => {
        debuglog("removing uncaughtException and unhandledRejection listeners")

        process.off("uncaughtException", uncaughtException)
        process.off("unhandledRejection", uncaughtException)
      })
    })
  }

  on(event: "request", listener: (req: Request, resp: Response) => void): this
  on(
    event: RoutingEvent,
    listener: (req: Request, resp: Response) => void
  ): this
  on(event: string, listener: (...args: unknown[]) => void): this
  on(event: string, listener: (...args: any[]) => void): this
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener)
  }

  private _emit(event: RoutingEvent, req: Request, resp: Response): boolean
  private _emit(event: string | symbol, ...args: any[]): boolean {
    return this.emit(event, ...args)
  }

  private routes(): Route[] {
    return this.eventNames()
      .map((eventName) => {
        debuglog("installing route:", eventName)

        if (typeof eventName !== "string") return

        const method = METHODS.find((m) => eventName.startsWith(`${m} `))
        if (!method) return

        let pathPattern: RegExp
        try {
          pathPattern = new RegExp(
            `^${eventName.slice(method.length + 1)}$`,
            "i"
          )
        } catch (error: unknown) {
          if (error instanceof Error) {
            console.error("WARN", error.message)
          }

          console.error("failed to install", eventName)
          return
        }

        return {
          eventName: eventName as `${METHODS} ${string}`,
          method,
          pathPattern,
        }
      })
      .filter(nonNullable)
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
