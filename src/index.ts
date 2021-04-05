import formidable from "formidable"
import * as fs from "fs"
import * as path from "path"
import { parse } from "./parse"
import { createServer } from "./server"

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
          req.headers.host ?? `${option.hostname}:${option.port}`
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

    server.on("GET /posts(?<id>/.+)?", (req, resp, { pathParam: { id } }) => {
      console.debug("id", id)

      resp.end(id)
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
