// accountManager.js  
const { Client } = require("pg");  
  
// Correct DB and table  
const DB_CONFIG = {
  host: "aws-1-eu-west-1.pooler.supabase.com",
  user: "postgres.gcmoppkkplzztiayvbdk",
  password: "ST!k7vuRpVBu.pm",
  database: "postgres",
  port: 5432,
  ssl: { rejectUnauthorized: false }
};  
  
const TABLE_NAME = "jumptask";  
  
async function getClient() {  
  const client = new Client(DB_CONFIG);  
  await client.connect();  
  return client;  
}  
  
// =======================================  
// Claim a free account (LRU scheduling)  
// =======================================  
async function claimAccount(vmId) {  
  const client = await getClient();  
  try {  
    await client.query("BEGIN");  
  
    const res = await client.query(`  
      SELECT id, Accounts AS account, user_agent, excluded_tasks  
      FROM ${TABLE_NAME}  
      WHERE status = 'free'  
      ORDER BY  
        balance_updated_at IS NOT NULL,  -- NULL first (never run)  
        balance_updated_at ASC,          -- oldest run first  
        id ASC                           -- deterministic tie-breaker  
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
      UPDATE ${TABLE_NAME}  
      SET status = 'claimed',  
          claimed_by = $1,  
          last_heartbeat = NOW()  
      WHERE id = $2  
      `,  
      [vmId, acc.id]  
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
  
// =======================================  
// Update balance or other fields  
// =======================================  
async function updateAccount(id, fields = {}) {  
  const client = await getClient();  
  try {  
    const keys = Object.keys(fields);  
    if (!keys.length) return;  
  
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");  
    const values = Object.values(fields);  
  
    await client.query(  
      `  
      UPDATE ${TABLE_NAME}  
      SET ${setClause},  
          balance_updated_at = NOW()  
      WHERE id = $${keys.length + 1}  
      `,  
      [...values, id]  
    );  
  } finally {  
    await client.end();  
  }  
}  
  
// =======================================  
// Release account back to free  
// =======================================  
async function releaseAccount(id) {  
  const client = await getClient();  
  try {  
    await client.query(  
      `  
      UPDATE ${TABLE_NAME}  
      SET status = 'free',  
          claimed_by = NULL,  
          last_heartbeat = NULL  
      WHERE id = $1  
      `,  
      [id]  
    );  
  } finally {  
    await client.end();  
  }  
}  
  
// =======================================  
// Send heartbeat (silent)  
// =======================================  
async function heartbeat(id) {  
  const client = await getClient();  
  try {  
    await client.query(  
      `  
      UPDATE ${TABLE_NAME}  
      SET last_heartbeat = NOW()  
      WHERE id = $1  
      `,  
      [id]  
    );  
  } finally {  
    await client.end();  
  }  
}  
  
// =======================================  
// Get excluded tasks  
// =======================================  
async function getExcludedTasks(id) {  
  const client = await getClient();  
  try {  
    const res = await client.query(  
      `SELECT excluded_tasks FROM ${TABLE_NAME} WHERE id = $1`,  
      [id]  
    );  
    return res.rows[0]?.excluded_tasks || [];  
  } finally {  
    await client.end();  
  }  
}  
  
// =======================================  
// Add excluded task (jsonb-safe, no overwrite)  
// =======================================  
async function addExcludedTask(id, taskId, query) {  
  const client = await getClient();  
  try {  
    await client.query(  
      `  
      UPDATE ${TABLE_NAME}  
      SET excluded_tasks =  
        COALESCE(excluded_tasks, '[]'::jsonb) ||  
        jsonb_build_array(  
          jsonb_build_object(  
            'taskId', $1,  
            'query', $2  
          )  
        )  
      WHERE id = $3  
      `,  
      [taskId, query, id]  
    );  
  } finally {  
    await client.end();  
  }  
}  
  
module.exports = {  
  claimAccount,  
  updateAccount,  
  releaseAccount,  
  heartbeat,  
  getExcludedTasks,  
  addExcludedTask,  
};