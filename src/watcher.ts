import * as fs from "fs"
import * as path from "path"

interface Watcher extends fs.FSWatcher {
  prevContent?: string

  // changed
  on(event: "changed", listener: (data: string) => void): this
  once(event: "changed", listener: (data: string) => void): this
  emit(event: "changed", data: string): boolean

  // warn
  on(event: "warn", listener: (err: unknown) => void): this
  once(event: "warn", listener: (data: string) => void): this
  emit(event: "warn", err: unknown): boolean

  // general
  on(event: string, listener: (...args: unknown[]) => void): this
  on(event: string, listener: (...args: any[]) => void): this

  once(event: string, listener: (...args: unknown[]) => void): this
  once(event: string, listener: (...args: any[]) => void): this

  emit(event: string, ...args: any[]): boolean
}

export function watchFile(filePath: string): Watcher {
  const dirPath = path.dirname(filePath)

  return fs.watch(
    dirPath,
    {
      // Watcher が残っていることを理由にプロセスが終わらない状態に陥るのを避ける。
      persistent: false,
    },
    async function (
      this: Watcher,
      event: "rename" | "change",
      filename: string | Buffer | null
    ) {
      if (typeof filename !== "string") return
      if (path.resolve(dirPath, filename) !== filePath) return

      try {
        const content = (await fs.promises.readFile(filePath)).toString()
        if (this.prevContent === content) return

        this.prevContent = content

        this.emit("changed", content)
      } catch (err: unknown) {
        this.emit("warn", err)
      }
    }
  )
}
