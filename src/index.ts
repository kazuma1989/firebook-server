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

    // ロギング
    server.on("request", (req, resp) => {
      console.log("request", req.method, req.url)

      req.on("warn", (info) => {
        switch (info.type) {
          case "warn/chunk-is-not-a-buffer": {
            console.warn(info.message, util.inspect(info.payload))
            break
          }
        }
      })
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
        if (!file) {
          resp.endAs("404 Not Found")
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
          .on("error", () => {
            resp.endAs("404 Not Found")
          })
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
          .on("error", (err) => {
            console.error(err)

            resp.endAs("503 Service Unavailable")
          })
      }
    )

    // ファイルアップロードのエンドポイント。
    server.on("POST /storage", (req, resp) => {
      const form = new formidable.IncomingForm({
        uploadDir: storageDir,
        keepExtensions: true,
      })

      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error("error", err)

          resp.endAs("400 Bad Request")
          return
        }

        const [file] = Object.values(files)
        if (!file || Array.isArray(file)) {
          resp.endAs("400 Bad Request")
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
            resp.endAs("404 Not Found")
            return
          }

          resp.end(stringify(item))
        }
      )

      server.on(`POST /${key}` as "POST /key", async (req, resp, { url }) => {
        if (req.mimeType !== "application/json") {
          resp.endAs(
            "400 Bad Request",
            `Content-Type is not "application/json"`
          )
          return
        }

        const body = await req.parseBodyAsJSONObject().catch(() => null)
        if (!body) {
          resp.endAs("400 Bad Request", "Malformed JSON input")
          return
        }

        try {
          const item = {
            ...body,
            id: randomID(),
          }

          db[key]!.push(item)

          await writer.write(JSON.stringify(db, null, 2) + "\n")

          resp.writeHead(201, {
            Location: `${url.toString()}/${item.id}`,
          })
          resp.end(stringify(item))
        } catch (err) {
          console.error(err)

          resp.endAs("503 Service Unavailable")
        }
      })

      server.on(
        `PUT /${key}/(?<id>.+)` as "PUT /key/:id",
        async (req, resp, { url, pathParam: { id } }) => {
          if (!id) {
            resp.endAs("405 Method Not Allowed")
            return
          }

          if (req.mimeType !== "application/json") {
            resp.endAs(
              "400 Bad Request",
              `Content-Type is not "application/json"`
            )
            return
          }

          const body = await req.parseBodyAsJSONObject().catch(() => null)
          if (!body) {
            resp.endAs("400 Bad Request", "Malformed JSON input")
            return
          }

          try {
            const item = {
              ...body,
              id,
            }

            const index = db[key]!.findIndex((v) => v.id === item.id)
            const exists = index !== -1
            if (exists) {
              db[key]!.splice(index, 1, item)
            } else {
              db[key]!.push(item)
            }

            await writer.write(JSON.stringify(db, null, 2) + "\n")

            resp.writeHead(exists ? 200 : 201, {
              Location: url.toString(),
            })
            resp.end(stringify(item))
          } catch (err) {
            console.error(err)

            resp.endAs("503 Service Unavailable")
          }
        }
      )

      server.on(
        `PATCH /${key}/(?<id>.+)` as "PATCH /key/:id",
        async (req, resp, { url, pathParam: { id } }) => {
          if (!id) {
            resp.endAs("405 Method Not Allowed")
            return
          }

          if (req.mimeType !== "application/json") {
            resp.endAs(
              "400 Bad Request",
              `Content-Type is not "application/json"`
            )
            return
          }

          const body = await req.parseBodyAsJSONObject().catch(() => null)
          if (!body) {
            resp.endAs("400 Bad Request", "Malformed JSON input")
            return
          }

          try {
            const item = db[key]!.find((v) => v.id === id)
            if (!item) {
              resp.endAs("404 Not Found")
              return
            }

            Object.assign(item, {
              ...body,
              id,
            })

            await writer.write(JSON.stringify(db, null, 2) + "\n")

            resp.writeHead(200, {
              Location: url.toString(),
            })
            resp.end(stringify(item))
          } catch (err) {
            console.error(err)

            resp.endAs("503 Service Unavailable")
          }
        }
      )

      server.on(
        `DELETE /${key}/(?<id>.+)` as "DELETE /key/:id",
        (req, resp, { pathParam: { id } }) => {
          resp.endAs("405 Method Not Allowed")
          return
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
