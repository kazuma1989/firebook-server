import * as assert from "assert"
import { test } from "uvu"
import { match } from "./util"

test("match: 異なるキーなら AND 条件、同じキーなら OR 条件で合致判定する", async () => {
  const url = new URL("/?foo=FOO&foo=FOO2&bar=BAR", "https://example.com")
  const matcher = match(url.searchParams.entries())

  assert.ok(
    matcher({
      foo: "FOO",
      bar: "BAR",
    })
  )

  assert.ok(
    matcher({
      foo: "FOO2",
      bar: "BAR",
    })
  )

  assert.ok(!matcher({}))

  assert.ok(
    !matcher({
      foo: "FOO",
    })
  )

  assert.ok(
    !matcher({
      bar: "BAR",
    })
  )
})

test("match: 検索キーがないときは全部合致判定する", async () => {
  const url = new URL("/", "https://example.com")
  const matcher = match(url.searchParams.entries())

  assert.ok(
    matcher({
      foo: "FOO",
      bar: "BAR",
    })
  )

  assert.ok(
    matcher({
      foo: "FOO2",
      bar: "BAR",
    })
  )

  assert.ok(matcher({}))

  assert.ok(
    matcher({
      foo: "FOO",
    })
  )

  assert.ok(
    matcher({
      bar: "BAR",
    })
  )
})

test.run()
