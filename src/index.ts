import formidable from "formidable"
import * as fs from "fs"
import * as path from "path"
import { parse } from "./parse"
import { createServer } from "./server"

/**
 * メインの処理。
 */
async function run() {
  const stringify = (value: any) => {
    return JSON.stringify(value, null, 4)
  }

  try {
    const option = parse(process.argv.slice(2))

    const storageDir = path.resolve(process.cwd(), option.storage)
    const databaseFile = path.resolve(process.cwd(), option.database)

    const server = createServer()

    server.on("request", (req, resp) => {
      console.log("request", req.method, req.url)
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
          req.headers.host ?? `${option.hostname}:${option.port}`
        }`

        resp.writeHead(200, {
          "Content-Type": "application/json",
        })
        resp.end(
          stringify({
            downloadURL: `${origin}/storage/${path.basename(file.path)}`,
          })
        )
      })
    })

    //
    const db = JSON.parse(
      (await fs.promises.readFile(databaseFile)).toString()
    ) as Record<string, { id: string }[]>

    Object.keys(db).forEach((key) => {
      if (!key.match(/^[A-Za-z0-9_-]+$/i)) return

      server.on(`GET /${key}` as "GET /key", (req, resp, {}) => {
        resp.end(stringify(db[key]!))
      })

      server.on(
        `GET /${key}/(?<id>.+)` as "GET /key/:id",
        (req, resp, { pathParam: { id } }) => {
          const item = db[key]!.find((v) => v.id === id)
          if (!item) {
            resp.writeHead(404)
            resp.end("{}")
            return
          }

          resp.end(stringify(item))
        }
      )

      server.on(`POST /${key}` as "POST /key", (req, resp, {}) => {
        resp.writeHead(400)
        resp.end("{}")
      })

      server.on(
        `PUT /${key}/(?<id>.+)` as "PUT /key/:id",
        (req, resp, { pathParam: { id } }) => {
          resp.writeHead(400)
          resp.end("{}")
        }
      )

      server.on(
        `PATCH /${key}/(?<id>.+)` as "PATCH /key/:id",
        (req, resp, { pathParam: { id } }) => {
          resp.writeHead(400)
          resp.end("{}")
        }
      )

      server.on(
        `DELETE /${key}/(?<id>.+)` as "DELETE /key/:id",
        (req, resp, { pathParam: { id } }) => {
          resp.writeHead(400)
          resp.end("{}")
        }
      )
    })

    server.listen(option.port, option.hostname, () => {
      console.log(
        `Server is listening at http://${option.hostname}:${option.port}`
      )
    })
  } catch (err) {
    console.error(err)

    process.exit(1)
  }
}

run()
