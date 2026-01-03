const { Client } = require("pg");

const DB_CONFIG = {
  host: "35.225.142.237",
  user: "neobot",
  password: "Edmond99",
  database: "neobux",
  port: 5432,
};

const VM_ID = process.env.VM_ID || `vm-${Math.random().toString(36).slice(2, 8)}`;

const HEARTBEAT_INTERVAL = 30_000; // 30s

async function getClient() {
  const client = new Client(DB_CONFIG);
  await client.connect();
  return client;
}

async function claimAccount() {
  const client = await getClient();

  try {
    await client.query("BEGIN");

    const res = await client.query(`
      SELECT id, username, email, password, user_agent
      FROM accounts
      WHERE status = 'free'
      ORDER BY id
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);

    if (!res.rows.length) {
      await client.query("ROLLBACK");
      return null;
    }

    const acc = res.rows[0];

    await client.query(
      `
      UPDATE accounts
      SET status = 'claimed',
          claimed_by = $1,
          last_heartbeat = NOW()
      WHERE id = $2
      `,
      [VM_ID, acc.id]
    );

    await client.query("COMMIT");
    return acc;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

async function heartbeat(username) {
  const client = await getClient();
  try {
    await client.query(
      `
      UPDATE accounts
      SET last_heartbeat = NOW()
      WHERE username = $1 AND claimed_by = $2
      `,
      [username, VM_ID]
    );
  } finally {
    await client.end();
  }
}

async function releaseAccount(username) {
  const client = await getClient();
  try {
    await client.query(
      `
      UPDATE accounts
      SET status = 'free',
          claimed_by = NULL,
          last_heartbeat = NULL
      WHERE username = $1 AND claimed_by = $2
      `,
      [username, VM_ID]
    );
  } finally {
    await client.end();
  }
}

module.exports = {
  claimAccount,
  heartbeat,
  releaseAccount,
  HEARTBEAT_INTERVAL,
  VM_ID,
};
