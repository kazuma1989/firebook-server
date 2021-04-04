import express from "express"
import formidable from "formidable"
import mri from "mri"
import * as path from "path"

/**
 * CLI 引数をパースする。
 */
function parse(argv: string[]) {
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

/**
 * メインの処理。
 */
async function run() {
  try {
    const option = parse(process.argv.slice(2))
    const storageDir = path.resolve(process.cwd(), option.storage)

    const app = express()

    // 開発サーバーなので緩い制約で CORS を受け入れる。
    app.use((req, resp, next) => {
      resp.setHeader("Access-Control-Allow-Origin", "*")
      resp.setHeader("Access-Control-Allow-Methods", "*")

      next()
    })

    // ファイルアップロードのエンドポイント。
    app.post("/storage", (req, resp, next) => {
      const form = new formidable.IncomingForm({
        uploadDir: storageDir,
        keepExtensions: true,
      })

      form.parse(req, (err, fields, files) => {
        if (err) {
          next(err)
          return
        }

        const [file] = Object.values(files)
        if (!file || Array.isArray(file)) {
          next()
          return
        }

        const origin = `http://${req.headers.host ?? option.host}:${
          option.port
        }`

        resp.json({
          downloadURL: `${origin}/storage/${path.basename(file.path)}`,
        })
      })
    })

    // storage ディレクトリの中身は静的ファイルとしてレスポンスする。
    app.use("/storage", express.static(storageDir))

    app.listen(option.port, option.host, () => {
      console.log(`Server is listening at http://${option.host}:${option.port}`)
    })
  } catch (err) {
    console.error(err)

    process.exit(1)
  }
}

run()
