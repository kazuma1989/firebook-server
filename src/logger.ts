import * as util from "util"

/**
 * 環境変数 NODE_DEBUG にパッケージ名を含むときだけログ出力する。
 */
export const debuglog = util.debuglog(PACKAGE_NAME)
