import { Router } from "express";
import { getConnection, oracledb } from "../lib/oracle";
import { requireAuth } from "../middleware/auth";

const router = Router();

// GET /api/sales
router.get("/sales", requireAuth, async (req, res) => {
  const { search } = req.query;
  let conn;
  try {
    conn = await getConnection();
    let sql = `
      SELECT s.SALE_ID, s.UNIT_ID, s.CUSTOMER_ID, s.SALE_DATE, s.SALE_AMOUNT, s.NOTES,
             u.UNIT_CODE, u.UNIT_NAME, u.PRICE as UNIT_PRICE,
             c.FULL_NAME as CUSTOMER_NAME, c.MOBILE as CUSTOMER_MOBILE,
             p.PROJECT_NAME, s.CREATED_DATE
      FROM SALES s
      JOIN UNITS u ON s.UNIT_ID = u.UNIT_ID
      JOIN CUSTOMERS c ON s.CUSTOMER_ID = c.CUSTOMER_ID
      JOIN PROJECTS p ON u.PROJECT_ID = p.PROJECT_ID
    `;
    const params: unknown[] = [];
    if (search) {
      sql += ` WHERE UPPER(u.UNIT_CODE) LIKE UPPER(:1) OR UPPER(c.FULL_NAME) LIKE UPPER(:2)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ` ORDER BY s.SALE_DATE DESC, s.SALE_ID DESC`;
    const result = await conn.execute(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    res.json(result.rows ?? []);
  } catch (err) {
    req.log.error({ err }, "Get sales error");
    res.status(500).json({ error: "Failed to fetch sales" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// GET /api/sales/:id
router.get("/sales/:id", requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT s.SALE_ID, s.UNIT_ID, s.CUSTOMER_ID, s.SALE_DATE, s.SALE_AMOUNT, s.NOTES,
              u.UNIT_CODE, u.UNIT_NAME, c.FULL_NAME as CUSTOMER_NAME, c.MOBILE as CUSTOMER_MOBILE, p.PROJECT_NAME
       FROM SALES s JOIN UNITS u ON s.UNIT_ID=u.UNIT_ID JOIN CUSTOMERS c ON s.CUSTOMER_ID=c.CUSTOMER_ID JOIN PROJECTS p ON u.PROJECT_ID=p.PROJECT_ID
       WHERE s.SALE_ID=:1`,
      [req.params["id"]], { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const rows = result.rows as unknown[];
    if (!rows?.length) { res.status(404).json({ error: "Sale not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    req.log.error({ err }, "Get sale error");
    res.status(500).json({ error: "Failed to fetch sale" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// POST /api/sales — mark unit as sold
router.post("/sales", requireAuth, async (req, res) => {
  const { unitId, customerId, saleDate, saleAmount, notes } = req.body;
  if (!unitId || !customerId || !saleDate || !saleAmount) {
    res.status(400).json({ error: "unitId, customerId, saleDate, saleAmount are required" }); return;
  }
  if (Number(saleAmount) <= 0) { res.status(400).json({ error: "Sale amount must be greater than 0" }); return; }
  const sess = req.session as Record<string, unknown>;
  let conn;
  try {
    conn = await getConnection();
    // Check unit exists and is not SOLD
    const unitChk = await conn.execute<[string]>(`SELECT STATUS FROM UNITS WHERE UNIT_ID=:1`, [unitId]);
    if (!unitChk.rows?.length) { res.status(404).json({ error: "Unit not found" }); return; }
    if (unitChk.rows[0][0] === "SOLD") { res.status(409).json({ error: "Unit is already sold" }); return; }

    // Insert sale
    await conn.execute(
      `INSERT INTO SALES (UNIT_ID, CUSTOMER_ID, SALE_DATE, SALE_AMOUNT, NOTES, CREATED_BY)
       VALUES (:1, :2, TO_DATE(:3,'YYYY-MM-DD'), :4, :5, :6)`,
      [unitId, customerId, saleDate, saleAmount, notes || null, sess["username"] || "USER"],
      { autoCommit: false },
    );

    // Update unit status to SOLD
    await conn.execute(
      `UPDATE UNITS SET STATUS='SOLD', UPDATED_BY=:1, UPDATED_DATE=SYSDATE WHERE UNIT_ID=:2`,
      [sess["username"] || "USER", unitId],
      { autoCommit: false },
    );

    await conn.commit();
    res.status(201).json({ message: "Sale completed — unit marked as SOLD" });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    req.log.error({ err }, "Create sale error");
    res.status(500).json({ error: "Failed to complete sale" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// PUT /api/sales/:id
router.put("/sales/:id", requireAuth, async (req, res) => {
  const { customerId, saleDate, saleAmount, notes } = req.body;
  if (!customerId || !saleDate || !saleAmount) {
    res.status(400).json({ error: "customerId, saleDate, saleAmount are required" }); return;
  }
  const sess = req.session as Record<string, unknown>;
  let conn;
  try {
    conn = await getConnection();
    const r = await conn.execute(
      `UPDATE SALES SET CUSTOMER_ID=:1, SALE_DATE=TO_DATE(:2,'YYYY-MM-DD'), SALE_AMOUNT=:3, NOTES=:4, UPDATED_BY=:5, UPDATED_DATE=SYSDATE WHERE SALE_ID=:6`,
      [customerId, saleDate, saleAmount, notes || null, sess["username"] || "USER", req.params["id"]],
      { autoCommit: true },
    );
    if ((r.rowsAffected ?? 0) === 0) { res.status(404).json({ error: "Sale not found" }); return; }
    res.json({ message: "Sale updated" });
  } catch (err) {
    req.log.error({ err }, "Update sale error");
    res.status(500).json({ error: "Failed to update sale" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

export default router;
