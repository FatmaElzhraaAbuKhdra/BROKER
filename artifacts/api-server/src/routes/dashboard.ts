import { Router } from "express";
import { getConnection, oracledb } from "../lib/oracle";
import { requireAuth } from "../middleware/auth";

const router = Router();

// GET /api/dashboard/kpis
router.get("/dashboard/kpis", requireAuth, async (_req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const [totalR, soldR, availR, salesR, recentSalesR] = await Promise.all([
      conn.execute<[number]>(`SELECT COUNT(*) FROM UNITS`),
      conn.execute<[number]>(`SELECT COUNT(*) FROM UNITS WHERE STATUS='SOLD'`),
      conn.execute<[number]>(`SELECT COUNT(*) FROM UNITS WHERE STATUS='AVAILABLE'`),
      conn.execute<[number]>(`SELECT NVL(SUM(SALE_AMOUNT),0) FROM SALES`),
      conn.execute(
        `SELECT s.SALE_ID, u.UNIT_CODE, u.UNIT_NAME, c.FULL_NAME as CUSTOMER_NAME, s.SALE_AMOUNT, s.SALE_DATE
         FROM SALES s JOIN UNITS u ON s.UNIT_ID=u.UNIT_ID JOIN CUSTOMERS c ON s.CUSTOMER_ID=c.CUSTOMER_ID
         ORDER BY s.SALE_DATE DESC FETCH FIRST 5 ROWS ONLY`,
        [], { outFormat: oracledb.OUT_FORMAT_OBJECT },
      ),
    ]);

    res.json({
      totalUnits: totalR.rows?.[0]?.[0] ?? 0,
      soldUnits: soldR.rows?.[0]?.[0] ?? 0,
      availableUnits: availR.rows?.[0]?.[0] ?? 0,
      totalSalesValue: salesR.rows?.[0]?.[0] ?? 0,
      recentSales: recentSalesR.rows ?? [],
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch dashboard KPIs" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// GET /api/dashboard/units-by-type
router.get("/dashboard/units-by-type", requireAuth, async (_req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT t.TYPE_NAME, COUNT(u.UNIT_ID) as COUNT
       FROM UNIT_TYPES t LEFT JOIN UNITS u ON t.TYPE_ID = u.TYPE_ID
       GROUP BY t.TYPE_NAME ORDER BY COUNT DESC`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    res.json(result.rows ?? []);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch units by type" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// GET /api/dashboard/sales-by-project
router.get("/dashboard/sales-by-project", requireAuth, async (_req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT p.PROJECT_NAME, COUNT(s.SALE_ID) as SALES_COUNT, NVL(SUM(s.SALE_AMOUNT),0) as TOTAL_AMOUNT
       FROM PROJECTS p LEFT JOIN UNITS u ON p.PROJECT_ID=u.PROJECT_ID LEFT JOIN SALES s ON u.UNIT_ID=s.UNIT_ID
       GROUP BY p.PROJECT_NAME ORDER BY TOTAL_AMOUNT DESC`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    res.json(result.rows ?? []);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch sales by project" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// GET /api/dashboard/units-status
router.get("/dashboard/units-status", requireAuth, async (_req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT STATUS, COUNT(*) as COUNT FROM UNITS GROUP BY STATUS`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    res.json(result.rows ?? []);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch unit status" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

export default router;
