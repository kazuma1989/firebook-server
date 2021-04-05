import mri from "mri"

interface CLIOption {
  host: string
  port: number
  storage: string
}

/**
 * CLI 引数をパースする。
 */
export function parse(argv: string[]): CLIOption {
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
