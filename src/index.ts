import formidable from "formidable"
import * as fs from "fs"
import * as path from "path"
import { Writer } from "steno"
import * as util from "util"
import { helpMessage, parse } from "./parse"
import { reducer } from "./reducer"
import { createServer } from "./server"
import { Store } from "./store"
import { randomID } from "./util"
import { watchFile } from "./watcher"

/**
 * メインの処理。
 */
async function run() {
  try {
    const option = parse(process.argv.slice(2))
    if (option.help) {
      console.log(helpMessage)
      return
    }
    if (option.version) {
      console.log(PACKAGE_VERSION)
      return
    }

    const stringify = (value: any) => {
      return JSON.stringify(value, null, 4)
    }

    const storageDir = path.resolve(process.cwd(), option.storage)
    const databaseFile = path.resolve(process.cwd(), option.database)

    const initialDatabaseContent = (
      await fs.promises.readFile(databaseFile)
    ).toString()

    let store = new Store(reducer, JSON.parse(initialDatabaseContent))

    const watcher = watchFile(databaseFile)
    watcher.on("changed", async (content) => {
      store = new Store(reducer, JSON.parse(content))

      server.close()
      server = await start()
    })
    watcher.prevContent = initialDatabaseContent

    const writer = new Writer(databaseFile)
    const write = async () => {
      const content = JSON.stringify(store.getState(), null, 2) + "\n"

      watcher.prevContent = content

      await writer.write(content)
    }

    const start = async () => {
      const server = createServer()

      // ロギング
      server.on("request", (req, resp) => {
        console.log(`[${new Date().toJSON()}]`, req.method, req.url)

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
      Object.keys(store.getState()).forEach((key) => {
        if (!key.match(/^[A-Za-z0-9_-]+$/i)) return

        // GET all
        server.on(`GET /${key}` as "GET /key", (req, resp, {}) => {
          const items = store.getState()[key]
          if (!items) {
            resp.endAs("404 Not Found")
            return
          }

          resp.end(stringify(items))
        })

        // GET single
        server.on(
          `GET /${key}/(?<id>.+)` as "GET /key/:id",
          (req, resp, { pathParam: { id } }) => {
            const item = store.getState()[key]?.find((v) => v.id === id)
            if (!item) {
              resp.endAs("404 Not Found")
              return
            }

            resp.end(stringify(item))
          }
        )

        // POST
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

          const id = randomID()

          store.dispatch({
            type: "POST /key",
            payload: {
              key,
              id,
              body,
            },
          })

          const item = store.getState()[key]?.find((i) => i.id === id)
          if (!item) {
            resp.endAs("404 Not Found")
            return
          }

          await write()

          resp.writeHead(201, {
            Location: `${url.toString()}/${item.id}`,
          })
          resp.end(stringify(item))
        })

        // PUT
        server.on(
          `PUT /${key}/(?<id>.+)` as "PUT /key/:id",
          async (req, resp, { url, pathParam: { id } }) => {
            if (!id) {
              resp.endAs("400 Bad Request", "ID is required in path")
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

            store.dispatch({
              type: "PUT /key/:id",
              payload: {
                key,
                id,
                body,
              },
            })

            const item = store.getState()[key]?.find((i) => i.id === id)
            if (!item) {
              resp.endAs("404 Not Found")
              return
            }

            await write()

            resp.writeHead(200, {
              Location: url.toString(),
            })
            resp.end(stringify(item))
          }
        )

        // PATCH
        server.on(
          `PATCH /${key}/(?<id>.+)` as "PATCH /key/:id",
          async (req, resp, { url, pathParam: { id } }) => {
            if (!id) {
              resp.endAs("400 Bad Request", "ID is required in path")
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

            store.dispatch({
              type: "PATCH /key/:id",
              payload: {
                key,
                id,
                body,
              },
            })

            const item = store.getState()[key]?.find((i) => i.id === id)
            if (!item) {
              resp.endAs("404 Not Found")
              return
            }

            await write()

            resp.writeHead(200, {
              Location: url.toString(),
            })
            resp.end(stringify(item))
          }
        )

        // DELETE
        server.on(
          `DELETE /${key}/(?<id>.+)` as "DELETE /key/:id",
          async (req, resp, { pathParam: { id } }) => {
            if (!id) {
              resp.endAs("400 Bad Request", "ID is required in path")
              return
            }

            store.dispatch({
              type: "DELETE /key/:id",
              payload: {
                key,
                id,
              },
            })

            await write()

            resp.endAs("200 OK")
          }
        )
      })

      // listen
      return server.listen(option.port, option.hostname, () => {
        console.log(`${PACKAGE_NAME} v${PACKAGE_VERSION}`)
        console.log(`http://${option.hostname}:${option.port}`)
      })
    }

    let server = await start()
  } catch (err) {
    console.error(err)

    process.exit(1)
  }
}

run()
