import * as util from "util"

/**
 * 環境変数 NODE_DEBUG にパッケージ名を含むときだけログ出力する。
 */
export const debuglog = util.debuglog(PACKAGE_NAME)

/**
 * ランダムな ID `[A-Za-z0-9_-]{12}` を作成する。
 * 暗号学的強度はないので本格的な利用には耐えない。
 */
export function randomID() {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"
  const length = alphabet.length

  let id = ""
  for (let i = 12; i > 0; i--) {
    id += alphabet[(Math.random() * length) | 0]
  }

  return id
}

/**
 * null または undefined でないことを型的にも保証する。
 */
export function nonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined
}

/**
 * null または undefined でないことを型的にも保証する。
 */
export function assertIsDefined<T>(value: T): asserts value is NonNullable<T> {
  if (value !== null && value !== undefined) return

  throw new Error(`Expected 'value' to be defined, but received ${value}`)
}
