import mri from "mri"

interface CLIOption {
  /** @default "localhost" */
  hostname: string

  /** @default 5000 */
  port: number

  /** @default "storage" */
  storage: string

  /** @default "db.json" */
  database: string
}

/**
 * CLI 引数をパースする。
 */
export function parse(argv: string[]): CLIOption {
  const {
    hostname,
    port,
    storage,
    database,
  }: mri.DictionaryObject<unknown> = mri(argv, {
    default: {
      hostname: "localhost",
      port: 5000,
      storage: "storage",
      database: "db.json",
    },
    alias: {
      hostname: ["host"],
      database: ["db"],
    },
  })

  if (typeof hostname !== "string" || hostname === "") {
    throw new Error(`Invalid host: ${hostname}`)
  }
  if (typeof port !== "number") {
    throw new Error(`Invalid port: ${port}`)
  }
  if (typeof storage !== "string") {
    throw new Error(`Invalid storage: ${storage}`)
  }
  if (typeof database !== "string") {
    throw new Error(`Invalid database: ${database}`)
  }

  return {
    hostname,
    port,
    storage,
    database,
  }
}
