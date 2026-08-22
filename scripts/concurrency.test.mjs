import assert from "node:assert/strict";
import test from "node:test";
import { tryAcquireAdvisoryLock, releaseAdvisoryLock } from "../artifacts/api-server/src/lib/advisoryLock.ts";

function fakeLockClient() {
  let held = false;
  const queries = [];
  return {
    queries,
    async query(sql) {
      queries.push(sql);
      if (sql.includes("pg_try_advisory_lock")) {
        if (held) return { rows: [{ locked: false }] };
        held = true;
        return { rows: [{ locked: true }] };
      }
      if (sql.includes("pg_advisory_unlock")) {
        held = false;
        return { rows: [{ unlocked: true }] };
      }
      return { rows: [] };
    },
  };
}

test("concurrent bot lock attempts admit only one owner", async () => {
  const client = fakeLockClient();
  const results = await Promise.all([
    tryAcquireAdvisoryLock(client, 1844674410),
    tryAcquireAdvisoryLock(client, 1844674410),
  ]);
  assert.deepEqual(results.sort(), [false, true]);
  await releaseAdvisoryLock(client, 1844674410);
  assert.match(client.queries.at(-1), /pg_advisory_unlock\(1844674410\)/);
});

test("advisor lock can be reacquired after release", async () => {
  const client = fakeLockClient();
  assert.equal(await tryAcquireAdvisoryLock(client, 1844674408), true);
  assert.equal(await tryAcquireAdvisoryLock(client, 1844674408), false);
  await releaseAdvisoryLock(client, 1844674408);
  assert.equal(await tryAcquireAdvisoryLock(client, 1844674408), true);
});
