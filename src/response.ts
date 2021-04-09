import * as http from "http"

/**
 * Content-Type のデフォルト値が application/json
 */
export class JSONResponse extends http.ServerResponse {
  constructor(req: http.IncomingMessage) {
    super(req)

    this.setHeader("Content-Type", "application/json")
  }

  /**
   * `null` という文字列（JSON として解釈可能）を返す。
   *
   * @param status
   * @param message デフォルト以外のステータスメッセージにしたいときは指定する。
   */
  endAs(
    status:
      | "200 OK"
      | "400 Bad Request"
      | "404 Not Found"
      | "405 Method Not Allowed"
      | "503 Service Unavailable",
    message?: string
  ): void {
    const statusCode = parseInt(status.split(" ")[0]!) || 500

    if (message) {
      this.statusMessage = message
    }

    this.writeHead(statusCode, {
      "Content-Type": "application/json",
    })
    this.end("null")
  }
}
