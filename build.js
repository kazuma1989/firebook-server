// @ts-check
/// <reference lib="es2018" />

const esbuild = require("esbuild")
const mri = require("mri")
const path = require("path")
const { dependencies } = require("./package.json")

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
      external: Object.keys(dependencies),
      platform: "node",
      target: "node10.1.0",
      format: "cjs",
      entryPoints: [entryPoint],
      outfile,
      banner: {
        js: "#!/usr/bin/env node",
      },
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
