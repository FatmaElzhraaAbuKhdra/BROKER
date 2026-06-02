/**
 * Oracle Connection Test Script
 * Run: node scripts/test-oracle.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const oracledb = require('/home/runner/workspace/artifacts/api-server/node_modules/oracledb/index.js');

const host = process.env.Host;
const port = process.env.Port || '1521';
const serviceName = process.env.Service_Name;
const schema = process.env.Schema;
const password = process.env.Password;

if (!host || !serviceName || !schema || !password) {
  console.error('❌ Missing environment secrets: Host, Service_Name, Schema, Password');
  process.exit(1);
}

const connectString = `${host}:${port}/${serviceName}`;
console.log('🔌 Testing Oracle connection...');
console.log(`   Host:    ${host}`);
console.log(`   Port:    ${port}`);
console.log(`   Service: ${serviceName}`);
console.log(`   Schema:  ${schema}`);
console.log(`   Connect: ${connectString}`);
console.log('');

let conn;
try {
  conn = await oracledb.getConnection({
    user: schema,
    password: password,
    connectString,
  });

  const result = await conn.execute('SELECT SYSDATE, USER, SYS_CONTEXT(\'USERENV\',\'DB_NAME\') AS DB_NAME FROM DUAL');
  const row = result.rows[0];
  console.log('✅ Oracle Connection SUCCESSFUL');
  console.log(`   Server Date: ${row[0]}`);
  console.log(`   Connected As: ${row[1]}`);
  console.log(`   Database: ${row[2]}`);

  // Check existing tables
  const tablesResult = await conn.execute(
    `SELECT TABLE_NAME FROM USER_TABLES ORDER BY TABLE_NAME`
  );
  console.log(`\n📋 Existing tables in schema (${tablesResult.rows.length}):`);
  if (tablesResult.rows.length === 0) {
    console.log('   (none — fresh schema)');
  } else {
    tablesResult.rows.forEach(r => console.log(`   - ${r[0]}`));
  }

  await conn.close();
  process.exit(0);
} catch (err) {
  console.error('❌ Oracle Connection FAILED');
  console.error(`   Error: ${err.message}`);
  if (conn) {
    try { await conn.close(); } catch {}
  }
  process.exit(1);
}
