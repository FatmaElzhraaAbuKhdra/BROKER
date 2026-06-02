import { Router } from "express";
import { getConnection, oracledb } from "../lib/oracle";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

// GET /api/customers
router.get("/customers", requireAuth, async (req, res) => {
  const { search } = req.query;
  let conn;
  try {
    conn = await getConnection();
    let sql = `SELECT CUSTOMER_ID, FULL_NAME, MOBILE, EMAIL, NATIONAL_ID, ADDRESS, NOTES, CREATED_DATE FROM CUSTOMERS`;
    const params: unknown[] = [];
    if (search) {
      sql += ` WHERE UPPER(FULL_NAME) LIKE UPPER(:1) OR MOBILE LIKE :2`;
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ` ORDER BY CUSTOMER_ID`;
    const result = await conn.execute(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    res.json(result.rows ?? []);
  } catch (err) {
    req.log.error({ err }, "Get customers error");
    res.status(500).json({ error: "Failed to fetch customers" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// GET /api/customers/:id
router.get("/customers/:id", requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT CUSTOMER_ID, FULL_NAME, MOBILE, EMAIL, NATIONAL_ID, ADDRESS, NOTES, CREATED_DATE FROM CUSTOMERS WHERE CUSTOMER_ID=:1`,
      [req.params["id"]], { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const rows = result.rows as unknown[];
    if (!rows?.length) { res.status(404).json({ error: "Customer not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    req.log.error({ err }, "Get customer error");
    res.status(500).json({ error: "Failed to fetch customer" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// POST /api/customers
router.post("/customers", requireAuth, async (req, res) => {
  const { fullName, mobile, email, nationalId, address, notes } = req.body;
  if (!fullName || !mobile) { res.status(400).json({ error: "fullName and mobile are required" }); return; }
  const sess = req.session as Record<string, unknown>;
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `INSERT INTO CUSTOMERS (FULL_NAME, MOBILE, EMAIL, NATIONAL_ID, ADDRESS, NOTES, CREATED_BY) VALUES (:1,:2,:3,:4,:5,:6,:7)`,
      [fullName, mobile, email || null, nationalId || null, address || null, notes || null, sess["username"] || "ADMIN"],
      { autoCommit: true },
    );
    res.status(201).json({ message: "Customer created" });
  } catch (err) {
    req.log.error({ err }, "Create customer error");
    res.status(500).json({ error: "Failed to create customer" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// PUT /api/customers/:id
router.put("/customers/:id", requireAuth, async (req, res) => {
  const { fullName, mobile, email, nationalId, address, notes } = req.body;
  if (!fullName || !mobile) { res.status(400).json({ error: "fullName and mobile are required" }); return; }
  const sess = req.session as Record<string, unknown>;
  let conn;
  try {
    conn = await getConnection();
    const r = await conn.execute(
      `UPDATE CUSTOMERS SET FULL_NAME=:1, MOBILE=:2, EMAIL=:3, NATIONAL_ID=:4, ADDRESS=:5, NOTES=:6, UPDATED_BY=:7, UPDATED_DATE=SYSDATE WHERE CUSTOMER_ID=:8`,
      [fullName, mobile, email || null, nationalId || null, address || null, notes || null, sess["username"] || "ADMIN", req.params["id"]],
      { autoCommit: true },
    );
    if ((r.rowsAffected ?? 0) === 0) { res.status(404).json({ error: "Customer not found" }); return; }
    res.json({ message: "Customer updated" });
  } catch (err) {
    req.log.error({ err }, "Update customer error");
    res.status(500).json({ error: "Failed to update customer" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// DELETE /api/customers/:id
router.delete("/customers/:id", requireAdmin, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const chk = await conn.execute<[number]>(`SELECT COUNT(*) FROM SALES WHERE CUSTOMER_ID=:1`, [req.params["id"]]);
    if ((chk.rows?.[0]?.[0] ?? 0) > 0) {
      res.status(409).json({ error: "Cannot delete: customer has associated sales" }); return;
    }
    const r = await conn.execute(`DELETE FROM CUSTOMERS WHERE CUSTOMER_ID=:1`, [req.params["id"]], { autoCommit: true });
    if ((r.rowsAffected ?? 0) === 0) { res.status(404).json({ error: "Customer not found" }); return; }
    res.json({ message: "Customer deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete customer error");
    res.status(500).json({ error: "Failed to delete customer" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

export default router;
