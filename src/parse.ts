import mri from "mri"

interface CLIOption {
  hostname: string
  port: number
  storage: string
}

/**
 * CLI 引数をパースする。
 */
export function parse(argv: string[]): CLIOption {
  const { host: hostname, port, storage } = mri(argv, {
    default: {
      hostname: "localhost",
      port: 5000,
      storage: "storage",
    },
    alias: {
      hostname: ["host"],
    },
  }) as mri.DictionaryObject<unknown>

  if (typeof hostname !== "string" || hostname === "") {
    throw new Error(`Invalid host: ${hostname}`)
  }
  if (typeof port !== "number") {
    throw new Error(`Invalid port: ${port}`)
  }
  if (typeof storage !== "string") {
    throw new Error(`Invalid storage: ${storage}`)
  }

  return {
    hostname,
    port,
    storage,
  }
}
