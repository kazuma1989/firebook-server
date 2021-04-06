import formidable from "formidable"
import * as fs from "fs"
import * as path from "path"
import { Writer } from "steno"
import * as util from "util"
import { parse } from "./parse"
import { createServer } from "./server"
import { randomID } from "./util"

const NULL = "null"

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
    const db: Record<string, { id: string }[]> = JSON.parse(
      (await fs.promises.readFile(databaseFile)).toString()
    )
    const writer = new Writer(databaseFile)

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

      server.on(`POST /${key}` as "POST /key", async (req, resp, { url }) => {
        const badRequest = () => {
          resp.writeHead(400)
          resp.end(NULL)
        }

        const serviceUnavailable = () => {
          resp.writeHead(503)
          resp.end(NULL)
        }

        const [mimeType] =
          req.headers["content-type"]?.split(";").map((v) => v.trim()) ?? []
        if (mimeType !== "application/json") {
          badRequest()
          return
        }

        const chunks: Buffer[] = []
        for await (const chunk of req) {
          if (!(chunk instanceof Buffer)) {
            console.warn("chunk is not a buffer", util.inspect(chunk))
            break
          }

          chunks.push(chunk)
        }

        try {
          const body = Buffer.concat(chunks).toString()

          let item: {
            id: string
            [key: string]: unknown
          }
          try {
            item = {
              ...JSON.parse(body),
              id: randomID(),
            }
          } catch (err) {
            badRequest()
            return
          }

          db[key]!.push(item)

          await writer.write(JSON.stringify(db, null, 2) + "\n")

          resp.writeHead(201, {
            Location: `${url.toString()}/${item.id}`,
          })
          resp.end(stringify(item))
        } catch (err) {
          console.error(err)

          serviceUnavailable()
        }
      })

      server.on(
        `PUT /${key}/(?<id>.+)` as "PUT /key/:id",
        (req, resp, { pathParam: { id } }) => {
          resp.writeHead(405)
          resp.end("{}")
        }
      )

      server.on(
        `PATCH /${key}/(?<id>.+)` as "PATCH /key/:id",
        (req, resp, { pathParam: { id } }) => {
          resp.writeHead(405)
          resp.end("{}")
        }
      )

      server.on(
        `DELETE /${key}/(?<id>.+)` as "DELETE /key/:id",
        (req, resp, { pathParam: { id } }) => {
          resp.writeHead(405)
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
