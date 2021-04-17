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

/**
 * 引数の条件に合致するか判定する関数を返す。
 */
export function match(
  search: Iterable<[string, string]>
): (item: { [key: string]: unknown }) => boolean {
  const accMap = new Map<string, string[]>()

  for (const [key, value] of search) {
    let values = accMap.get(key)
    if (!values) {
      values = []
      accMap.set(key, values)
    }

    values.push(value)
  }

  return function matcher(item) {
    for (const [searchKey, searchValues] of accMap.entries()) {
      const itemValue = `${item[searchKey]}`

      if (!searchValues.includes(itemValue)) {
        return false
      }
    }

    return true
  }
}
