import * as util from "util"

/**
 * 環境変数 NODE_DEBUG にパッケージ名を含むときだけログ出力する。
 */
export const debuglog = util.debuglog(PACKAGE_NAME)

/**
 * ランダムな ID `[0-9A-Za-z_]{12}` を作成する。
 * 暗号学的強度はないので本格的な利用には耐えない。
 */
export function randomID() {
  const alphabet =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz"

  let id = ""
  for (let i = 12; i > 0; i--) {
    id += alphabet[(Math.random() * 64) | 0]
  }

  return id
}

/**
 * null または undefined でないことを型的にも保証する。
 */
export function nonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined
}
