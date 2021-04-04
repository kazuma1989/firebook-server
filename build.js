// @ts-check
/// <reference lib="es2018" />

const chokidar = require("chokidar")
const esbuild = require("esbuild")
const path = require("path")

async function run() {
  const [watch] = process.argv.slice(2)

  try {
    const entryPoint = path.resolve(__dirname, "src/index.ts")
    const outfile = path.resolve(__dirname, "dist/index.js")

    const buildSync = () => {
      esbuild.buildSync({
        charset: "utf8",
        bundle: false,
        platform: "node",
        target: "node10",
        format: "cjs",
        entryPoints: [entryPoint],
        outfile,
        define: {
          // Suppress warnings from Formidable.
          "global.GENTLY": JSON.stringify(false),
        },
      })

      console.log("Built!")
    }

    if (watch) {
      chokidar
        .watch(path.join(__dirname, "src/**/*.{ts,tsx}"))
        .on("all", buildSync)
    } else {
      buildSync()
    }
  } catch (err) {
    console.error(err)

    process.exit(1)
  }
}

run()
