export interface AdvisoryLockClient {
  query<T extends { locked?: boolean }>(sql: string): Promise<{ rows: T[] }>;
}

export async function tryAcquireAdvisoryLock(
  client: AdvisoryLockClient,
  lockId: number,
): Promise<boolean> {
  const result = await client.query<{ locked: boolean }>(
    `SELECT pg_try_advisory_lock(${lockId}) AS locked`,
  );
  return result.rows[0]?.locked === true;
}

export async function releaseAdvisoryLock(
  client: AdvisoryLockClient,
  lockId: number,
): Promise<void> {
  await client.query(`SELECT pg_advisory_unlock(${lockId})`);
}
