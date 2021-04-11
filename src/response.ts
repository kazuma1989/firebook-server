import * as http from "http"

/**
 */
export class JSONResponse extends http.ServerResponse {
  /**
   * @param status
   * @param headers
   */
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
}

export interface JSONResponse extends http.ServerResponse {
  setHeader(
    name:
      | "Access-Control-Allow-Headers"
      | "Access-Control-Allow-Methods"
      | "Access-Control-Allow-Origin"
      | "Access-Control-Expose-Headers"
      | "Content-Type"
      | "Location",
    value: number | string | ReadonlyArray<string>
  ): void
  setHeader(name: string, value: number | string | ReadonlyArray<string>): void

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
}

interface OutgoingHttpHeaders extends http.OutgoingHttpHeaders {
  "Content-Type"?: "application/json"
  Location?: number | string | string[] | undefined

  [header: string]: number | string | string[] | undefined
}
