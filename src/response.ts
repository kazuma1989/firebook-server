import * as http from "http"
import { debuglog } from "./util"

/**
 */
export interface Response {
  // error
  once(event: "error", listener: (err: Error) => void): this

  // finish
  once(event: "finish", listener: () => void): this

  // undefined events
  on(event: never, listener: (...args: any[]) => void): this
  once(event: never, listener: (...args: any[]) => void): this
  off(event: never, listener: (...args: any[]) => void): this
  emit(event: never, ...args: any[]): boolean
}

export class Response extends http.ServerResponse {
  /**
   * @param status
   * @param headers
   */
  writeStatus(
    status:
      | "200 OK"
      | "201 Created"
      | "204 No Content"
      | "400 Bad Request"
      | "404 Not Found"
      | "405 Method Not Allowed"
      | "415 Unsupported Media Type"
      | "500 Internal Server Error"
      | "503 Service Unavailable",
    headers?: OutgoingHttpHeaders
  ): this
  writeStatus(
    status: `${number} ${string}`,
    headers?: OutgoingHttpHeaders
  ): this
  writeStatus(
    status: `${number} ${string}`,
    headers?: OutgoingHttpHeaders
  ): this {
    const [statusCodeStr, ...words] = status.split(" ")
    const statusCode = parseInt(statusCodeStr!)
    if (isNaN(statusCode)) {
      throw new Error(`status code is not a number: "${status}"`)
    }

    const reasonPhrase = words.join(" ")

    this.writeHead(statusCode, reasonPhrase, headers)

    return this
  }

  setHeader(
    name:
      | "Access-Control-Allow-Headers"
      | "Access-Control-Allow-Methods"
      | "Access-Control-Allow-Origin"
      | "Access-Control-Expose-Headers"
      | "Content-Type"
      | "Location",
    value: number | string | ReadonlyArray<string>
  ): void {
    if (this.headersSent || this.finished) {
      debuglog('Headers sent or response finished. Skip "%s: %s"', name, value)
      return
    }

    super.setHeader(name, value)
  }
}

interface OutgoingHttpHeaders extends http.OutgoingHttpHeaders {
  "Content-Type"?: "application/json"
  Location?: number | string | string[] | undefined

  [header: string]: number | string | string[] | undefined
}
