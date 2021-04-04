import express from "express"
import formidable from "formidable"
import * as path from "path"

const app = express()
const port = 5000

// 開発サーバーなので緩い制約で CORS を受け入れる。
app.use((req, resp, next) => {
  resp.setHeader("Access-Control-Allow-Origin", "*")
  resp.setHeader("Access-Control-Allow-Methods", "*")

  next()
})

const storageDir = path.join(process.cwd(), "storage")

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

    const host = req.headers.host ?? `localhost:${port}`

    resp.json({
      downloadURL: `http://${host}/storage/${path.basename(file.path)}`,
    })
  })
})

// storage ディレクトリの中身は静的ファイルとしてレスポンスする。
app.use("/storage", express.static(storageDir))

app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`)
})
