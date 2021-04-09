import * as fs from "fs"
import * as path from "path"

interface Watcher extends fs.FSWatcher {
  prevContent?: string

  // changed
  on(event: "changed", listener: (data: string) => void): this
  emit(event: "changed", data: string): boolean

  // warn
  on(event: "warn", listener: (err: unknown) => void): this
  emit(event: "warn", err: unknown): boolean

  // general
  /** @deprecated avoid type ambiguity */
  on(event: string, listener: (...args: unknown[]) => void): this
  /** @deprecated avoid type ambiguity */
  on(event: string, listener: (...args: any[]) => void): this

  /** @deprecated avoid type ambiguity */
  emit(event: string, ...args: any[]): boolean
}

export function watchFile(filePath: string): Watcher {
  const dirPath = path.dirname(filePath)

  return fs.watch(
    dirPath,
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
      } catch (err) {
        this.emit("warn", err)
      }
    }
  )
}
