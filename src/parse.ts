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

  help: boolean
  version: boolean
}

export const helpMessage = `
${PACKAGE_NAME} v${PACKAGE_VERSION}

USAGE
    npx ${PACKAGE_NAME}
    npx ${PACKAGE_NAME} --port 3001
    npx ${PACKAGE_NAME} --db data.json --storage ./storage

OPTIONS
    --hostname, --host  エンドポイントのホストを指定します。
    --port              エンドポイントのポートを指定します。
    --storage           画像を読み書きするディレクトリを指定します。
    --database, --db    データを読み書きする JSON ファイルを指定します。
    -h, --help          ヘルプ（このメッセージ）を表示します。
    -v, --version       バージョンを表示します。
`.trim()

/**
 * CLI 引数をパースする。
 */
export function parse(argv: string[]): CLIOption {
  const {
    hostname,
    port,
    storage,
    database,
    help,
    version,
  }: mri.DictionaryObject<unknown> = mri(argv, {
    default: {
      hostname: "localhost",
      port: 5000,
      storage: "storage",
      database: "db.json",
      help: false,
      version: false,
    },
    alias: {
      hostname: ["host"],
      database: ["db"],
      help: ["h"],
      version: ["v"],
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
  if (typeof help !== "boolean") {
    throw new Error(`Invalid help: ${help}`)
  }
  if (typeof version !== "boolean") {
    throw new Error(`Invalid version: ${version}`)
  }

  return {
    hostname,
    port,
    storage,
    database,
    help,
    version,
  }
}
