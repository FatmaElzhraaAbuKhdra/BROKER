import oracledb from "oracledb";
import { logger } from "./logger";

let poolCreated = false;

export async function initPool(): Promise<void> {
  if (poolCreated) return;

  const host = process.env["Host"];
  const port = process.env["Port"] || "1521";
  const serviceName = process.env["Service_Name"];
  const schema = process.env["Schema"];
  const password = process.env["Password"];

  if (!host || !serviceName || !schema || !password) {
    throw new Error(
      "Missing Oracle secrets: Host, Service_Name, Schema, Password are required",
    );
  }

  const connectString = `${host}:${port}/${serviceName}`;

  try {
    await oracledb.createPool({
      user: schema,
      password: password,
      connectString,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 1,
      poolPingInterval: 60,
    });
    poolCreated = true;
    logger.info({ host, port, serviceName }, "Oracle connection pool created");
  } catch (err) {
    logger.error({ err }, "Failed to create Oracle connection pool");
    throw err;
  }
}

export async function getConnection(): Promise<oracledb.Connection> {
  if (!poolCreated) {
    await initPool();
  }
  return oracledb.getPool().getConnection();
}

export async function testConnection(): Promise<{
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}> {
  let conn: oracledb.Connection | null = null;
  try {
    conn = await getConnection();
    const result = await conn.execute<[Date, string, string]>(
      "SELECT SYSDATE, USER, SYS_CONTEXT('USERENV','DB_NAME') AS DB_NAME FROM DUAL",
    );
    const row = result.rows?.[0];
    return {
      success: true,
      message: "Oracle connection successful",
      details: {
        serverDate: row?.[0],
        connectedAs: row?.[1],
        database: row?.[2],
      },
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch {}
    }
  }
}

export { oracledb };
