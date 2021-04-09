import * as fs from "fs"
import * as path from "path"

interface Watcher<T = unknown> extends fs.FSWatcher {
  // changed
  on(event: "changed", listener: (data: T) => void): this
  emit(event: "changed", data: T): void

  on(event: string, listener: (...args: unknown[]) => void): this
  on(event: string, listener: (...args: any[]) => void): this

  emit(event: string, ...args: any[]): boolean
}

export function watchFile<T>(filePath: string): Watcher<T> {
  const dirPath = path.dirname(filePath)

  return fs.watch(
    dirPath,
    async function (this: Watcher<T>, event, filename: string | Buffer | null) {
      if (typeof filename !== "string") return
      if (path.resolve(dirPath, filename) !== filePath) return

      try {
        const data: T = JSON.parse(
          (await fs.promises.readFile(filePath)).toString()
        )

        this.emit("changed", data)
      } catch (err) {
        // TODO warning
      }
    }
  )
}
