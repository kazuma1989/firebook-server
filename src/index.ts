import formidable from "formidable"
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
function createServer(): Server {
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

/**
 * メインの処理。
 */
async function run() {
  try {
    const option = parse(process.argv.slice(2))
    const storageDir = path.resolve(process.cwd(), option.storage)

    const server = createServer()

    server.on("request", (req, resp) => {
      console.log("request", req.url)
    })

    // 開発サーバーなので緩い制約で CORS を受け入れる。
    server.on("request", (req, resp) => {
      resp.setHeader("Access-Control-Allow-Origin", "*")
      resp.setHeader("Access-Control-Allow-Methods", "*")
    })

    // storage ディレクトリの中身は静的ファイルとしてレスポンスする。
    server.on(
      "GET /storage/(?<file>.+)",
      (req, resp, { pathParam: { file } }) => {
        console.debug("file", file)

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

        const mimeTypes = {
          ".png": "image/png",
          ".jpg": "image/jpg",
          ".jpeg": "image/jpg",
          ".gif": "image/gif",
        }

        const filePath = path.join(storageDir, path.normalize(file))

        fs.createReadStream(filePath)
          .on("error", notFound)
          .once("open", () => {
            resp.setHeader(
              "Content-Type",
              mimeTypes[path.extname(filePath).toLowerCase()] ??
                "application/octet-stream"
            )
          })
          .pipe(resp)
          .on("finish", () => {
            resp.end()
          })
          .on("error", internalError)
      }
    )

    // ファイルアップロードのエンドポイント。
    server.on("POST /storage", (req, resp) => {
      const badRequest = () => {
        resp.writeHead(400)
        resp.end()
      }

      const form = new formidable.IncomingForm({
        uploadDir: storageDir,
        keepExtensions: true,
      })

      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error("error", err)

          badRequest()
          return
        }

        const [file] = Object.values(files)
        if (!file || Array.isArray(file)) {
          badRequest()
          return
        }

        const origin = `http://${
          req.headers.host ?? `${option.host}:${option.port}`
        }`

        resp.writeHead(200, {
          "Content-Type": "application/json",
        })
        resp.end(
          JSON.stringify({
            downloadURL: `${origin}/storage/${path.basename(file.path)}`,
          })
        )
      })
    })

    server.listen(option.port, option.host, () => {
      console.log(`Server is listening at http://${option.host}:${option.port}`)
    })
  } catch (err) {
    console.error(err)

    process.exit(1)
  }
}

run()
