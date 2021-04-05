// import formidable from "formidable"
import * as fs from "fs"
import * as http from "http"
import mri from "mri"
import * as path from "path"

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

interface CLIOption {
  host: string
  port: number
  storage: string
}

/**
 * CLI 引数をパースする。
 */
function parse(argv: string[]): CLIOption {
  const { host, port, storage } = mri(argv, {
    default: {
      host: "localhost",
      port: 5000,
      storage: "storage",
    },
  }) as mri.DictionaryObject<unknown>

  if (typeof host !== "string" || host === "") {
    throw new Error(`Invalid host: ${host}`)
  }
  if (typeof port !== "number") {
    throw new Error(`Invalid port: ${port}`)
  }
  if (typeof storage !== "string") {
    throw new Error(`Invalid storage: ${storage}`)
  }

  return {
    host,
    port,
    storage,
  }
}

interface Server extends http.Server {
  on(
    eventName: `${METHODS} ${string}`,
    listener: (
      req: http.IncomingMessage,
      resp: http.ServerResponse,
      route: Route
    ) => void
  ): this

  on(event: string, listener: (...args: any[]) => void): this
}

function createServer(): Server {
  return http
    .createServer()
    .once("listening", function setup(this: http.Server) {
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

      this.on(
        "request",
        (req: http.IncomingMessage, resp: http.ServerResponse) => {
          console.log("request", req.url)

          let route: Route | undefined
          for (let i = 0; i < routes.length; i++) {
            const { eventName, method, rawPathPattern, pathPattern } = routes[
              i
            ]!
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
          }

          if (!route) {
            resp.writeHead(404)
            resp.end()

            return
          }

          this.emit(route.eventName, req, resp, route)
        }
      )
    })
}

/**
 * メインの処理。
 */
async function run() {
  try {
    const option = parse(process.argv.slice(2))
    const storageDir = path.resolve(process.cwd(), option.storage)

    const server = createServer()

    server.on(
      "GET /storage/(?<file>.+)",
      (req, resp, { pathParam: { file } }) => {
        const notFound = () => {
          resp.writeHead(404)
          resp.end()
        }

        const internalError = () => {
          resp.writeHead(500)
          resp.end()
        }

        if (!file) {
          notFound()
          return
        }

        fs.createReadStream(path.resolve(storageDir, path.normalize(file)))
          .on("error", notFound)
          .pipe(resp)
          .on("finish", () => {
            resp.writeHead(200, { "Content-Type": "image/png" })
            resp.end()
          })
          .on("error", internalError)
      }
    )

    server.listen(option.port, option.host, () => {
      console.log(`Server is listening at http://${option.host}:${option.port}`)
    })

    // const app = express()

    // // 開発サーバーなので緩い制約で CORS を受け入れる。
    // app.use((req, resp, next) => {
    //   resp.setHeader("Access-Control-Allow-Origin", "*")
    //   resp.setHeader("Access-Control-Allow-Methods", "*")

    //   next()
    // })

    // // ファイルアップロードのエンドポイント。
    // app.post("/storage", (req, resp, next) => {
    //   const form = new formidable.IncomingForm({
    //     uploadDir: storageDir,
    //     keepExtensions: true,
    //   })

    //   form.parse(req, (err, fields, files) => {
    //     if (err) {
    //       next(err)
    //       return
    //     }

    //     const [file] = Object.values(files)
    //     if (!file || Array.isArray(file)) {
    //       next()
    //       return
    //     }

    //     const origin = `http://${req.headers.host ?? option.host}:${
    //       option.port
    //     }`

    //     resp.json({
    //       downloadURL: `${origin}/storage/${path.basename(file.path)}`,
    //     })
    //   })
    // })

    // // storage ディレクトリの中身は静的ファイルとしてレスポンスする。
    // app.use("/storage", express.static(storageDir))

    // app.listen(option.port, option.host, () => {
    //   console.log(`Server is listening at http://${option.host}:${option.port}`)
    // })
  } catch (err) {
    console.error(err)

    process.exit(1)
  }
}

run()
