// @ts-check
/// <reference lib="es2018" />

const esbuild = require("esbuild")
const mri = require("mri")
const path = require("path")
const semver = require("semver")
const { bin, dependencies, engines, name, version } = require("./package.json")

async function run() {
  try {
    const { watch } = mri(process.argv.slice(2), {
      boolean: ["watch"],
    })

    const entryPoint = path.resolve(__dirname, "src/index.ts")
    const outfile = path.resolve(__dirname, bin)

    await esbuild.build({
      charset: "utf8",
      sourcemap: true,
      sourcesContent: false,
      bundle: true,
      external: Object.keys(dependencies),
      platform: "node",
      target: `node${semver.minVersion(engines.node)}`,
      format: "cjs",
      entryPoints: [entryPoint],
      outfile,
      define: {
        PACKAGE_NAME: JSON.stringify(name),
        PACKAGE_VERSION: JSON.stringify(version),
      },
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
