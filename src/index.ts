import * as fs from "fs"
import * as path from "path"
import { Writer } from "steno"
import * as util from "util"
import { helpMessage, parse } from "./cli-option"
import { reducer } from "./reducer"
import { Server } from "./server"
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

    const writer = new Writer(databaseFile)

    let databaseContent = (await fs.promises.readFile(databaseFile)).toString()

    while (true) {
      const store = new Store(
        reducer,
        JSON.parse(databaseContent) as ReturnType<typeof reducer>
      )

      const watcher = watchFile(databaseFile)
      watcher.prevContent = databaseContent

      const databaseChanged$ = new Promise<void>((resolve) => {
        watcher.once("changed", (content) => {
          databaseContent = content
          resolve()
        })
      })

      const write = async () => {
        const content = JSON.stringify(store.getState(), null, 2) + "\n"

        watcher.prevContent = content

        await writer.write(content)
      }

      const server = new Server()

      // ロギング
      server.on("request", (req, resp) => {
        const { method, url } = req
        resp.on("finish", function (this: typeof resp) {
          console.log(
            `[${new Date().toJSON()}]`,
            this.statusCode,
            this.statusMessage,
            method,
            url
          )
        })

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
        resp.setHeader("Access-Control-Allow-Headers", "*")
        resp.setHeader("Access-Control-Expose-Headers", "*")

        // プリフライトリクエストはすべて受け入れる。
        if (req.method === "OPTIONS") {
          resp.writeStatus("200 OK").end()
        }
      })

      // storage ディレクトリの中身は静的ファイルとしてレスポンスする。
      server.on("GET /storage/(?<file>.+)", (req, resp) => {
        const { file } = req.route?.pathParam ?? {}
        if (!file) {
          resp.writeStatus("404 Not Found").end()
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
            resp.writeStatus("404 Not Found").end()
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

            resp.writeStatus("500 Internal Server Error").end()
          })
      })

      // ファイルアップロードのエンドポイント。
      server.on("POST /storage", async (req, resp) => {
        const mimeTypes = {
          ".png": "image/png",
          ".jpg": "image/jpg",
          ".jpeg": "image/jpg",
          ".gif": "image/gif",
        }

        const [ext] =
          Object.entries(mimeTypes).find(([, type]) => type === req.mimeType) ??
          []
        if (!ext) {
          resp.writeStatus("415 Unsupported Media Type").end()
          return
        }

        const filePath = path.join(storageDir, `${randomID()}${ext}`)

        req.pipe(fs.createWriteStream(filePath)).on("close", () => {
          const origin = `http://${
            req.headers.host ?? `${option.hostname}:${option.port}`
          }`
          const downloadURL = `${origin}/storage/${path.basename(filePath)}`

          resp
            .writeStatus("201 Created", {
              Location: downloadURL,
            })
            .end()
        })
      })

      // ファイル削除
      server.on("DELETE /storage/(?<file>.+)", async (req, resp) => {
        const { file } = req.route?.pathParam ?? {}
        if (!file) {
          throw new Error()
        }

        const filePath = path.join(storageDir, path.normalize(file))

        await fs.promises.unlink(filePath).catch(() => null)

        resp.writeStatus("204 No Content").end()
      })

      //
      Object.keys(store.getState()).forEach((key) => {
        if (!key.match(/^[A-Za-z0-9_-]+$/i)) return

        // GET all
        server.on(`GET /${key}` as "GET /key", (req, resp) => {
          const items = store.getState()[key]
          if (!items) {
            resp.writeStatus("404 Not Found").end()
            return
          }

          resp
            .writeStatus("200 OK", {
              "Content-Type": "application/json",
            })
            .end(stringify(items))
        })

        // GET single
        server.on(`GET /${key}/(?<id>.+)` as "GET /key/:id", (req, resp) => {
          const { id } = req.route?.pathParam ?? {}

          const item = store.getState()[key]?.find((v) => v.id === id)
          if (!item) {
            resp.writeStatus("404 Not Found").end()
            return
          }

          resp
            .writeStatus("200 OK", {
              "Content-Type": "application/json",
            })
            .end(stringify(item))
        })

        // POST
        server.on(`POST /${key}` as "POST /key", async (req, resp) => {
          if (req.mimeType !== "application/json") {
            resp.writeStatus("415 Unsupported Media Type").end()
            return
          }

          const body = await req.parseBodyAsJSONObject().catch(() => null)
          if (!body) {
            resp.writeStatus("400 Malformed JSON input").end()
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
            resp.writeStatus("500 Internal Server Error").end()
            return
          }

          await write()

          resp
            .writeStatus("201 Created", {
              "Content-Type": "application/json",
              Location: `${req.normalizedURL?.toString()}/${item.id}`,
            })
            .end(stringify(item))
        })

        // PUT
        server.on(
          `PUT /${key}/(?<id>.+)` as "PUT /key/:id",
          async (req, resp) => {
            const { id } = req.route?.pathParam ?? {}
            if (!id) {
              resp.writeStatus("500 Internal Server Error").end()
              return
            }

            if (req.mimeType !== "application/json") {
              resp.writeStatus("415 Unsupported Media Type").end()
              return
            }

            const body = await req.parseBodyAsJSONObject().catch(() => null)
            if (!body) {
              resp.writeStatus("400 Malformed JSON input").end()
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
              resp.writeStatus("500 Internal Server Error").end()
              return
            }

            await write()

            resp
              .writeStatus("200 OK", {
                "Content-Type": "application/json",
              })
              .end(stringify(item))
          }
        )

        // PATCH
        server.on(
          `PATCH /${key}/(?<id>.+)` as "PATCH /key/:id",
          async (req, resp) => {
            const { id } = req.route?.pathParam ?? {}
            if (!id) {
              resp.writeStatus("500 Internal Server Error").end()
              return
            }

            if (req.mimeType !== "application/json") {
              resp.writeStatus("415 Unsupported Media Type").end()
              return
            }

            const body = await req.parseBodyAsJSONObject().catch(() => null)
            if (!body) {
              resp.writeStatus("400 Bad Request").end()
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
              resp.writeStatus("500 Internal Server Error").end()
              return
            }

            await write()

            resp
              .writeStatus("200 OK", {
                "Content-Type": "application/json",
              })
              .end(stringify(item))
          }
        )

        // DELETE
        server.on(
          `DELETE /${key}/(?<id>.+)` as "DELETE /key/:id",
          async (req, resp) => {
            const { id } = req.route?.pathParam ?? {}
            if (!id) {
              resp.writeStatus("500 Internal Server Error").end()
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

            resp.writeStatus("204 No Content").end()
          }
        )
      })

      // listen
      server.listen(option.port, option.hostname, () => {
        console.log(`${PACKAGE_NAME} v${PACKAGE_VERSION}`)
        console.log(`http://${option.hostname}:${option.port}`)
      })

      await databaseChanged$

      server.close()

      console.log("Restarting...")
    }
  } catch (err: unknown) {
    console.error(err)

    process.exit(1)
  }
}

run()
