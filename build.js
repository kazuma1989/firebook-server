// @ts-check
/// <reference lib="es2018" />

const esbuild = require("esbuild")
const mri = require("mri")
const path = require("path")

async function run() {
  const { watch } = mri(process.argv.slice(2), {
    boolean: ["watch"],
  })

  try {
    const entryPoint = path.resolve(__dirname, "src/index.ts")
    const outfile = path.resolve(__dirname, "dist/index.js")

    await esbuild.build({
      charset: "utf8",
      sourcemap: true,
      bundle: true,
      external: ["formidable", "mri"],
      platform: "node",
      target: "node10",
      format: "cjs",
      entryPoints: [entryPoint],
      outfile,
      watch: watch
        ? {
            onRebuild() {
              console.error(`[${new Date().toJSON()}] rebuild`)
            },
          }
        : false,
    })
  } catch (err) {
    console.error(err)

    process.exit(1)
  }
}

run()
