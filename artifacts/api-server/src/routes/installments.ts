import { Router } from "express";
import { getConnection, oracledb } from "../lib/oracle";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

// GET /api/installments?unitId=
router.get("/installments", requireAuth, async (req, res) => {
  const { unitId } = req.query;
  if (!unitId) { res.status(400).json({ error: "unitId is required" }); return; }
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT INSTALLMENT_ID, UNIT_ID, DUE_DATE, AMOUNT, NVL(PAID_AMOUNT, 0) AS PAID_AMOUNT,
              PAID_DATE, STATUS, NOTES, CREATED_DATE
       FROM INSTALLMENTS WHERE UNIT_ID=:1 ORDER BY DUE_DATE, INSTALLMENT_ID`,
      [unitId], { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    res.json(result.rows ?? []);
  } catch (err) {
    req.log.error({ err }, "Get installments error");
    res.status(500).json({ error: "Failed to fetch installments" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// POST /api/installments
router.post("/installments", requireAdmin, async (req, res) => {
  const { unitId, dueDate, amount, paidAmount, paidDate, status, notes } = req.body;
  if (!unitId || !dueDate || amount === undefined || amount === null || amount === "") {
    res.status(400).json({ error: "unitId, dueDate, amount are required" }); return;
  }
  if (Number(amount) <= 0) { res.status(400).json({ error: "Amount must be greater than 0" }); return; }
  const sess = req.session as Record<string, unknown>;
  const paidAmountVal = paidAmount != null && paidAmount !== "" ? Number(paidAmount) : 0;
  const resolvedStatus = status || "PENDING";
  let conn;
  try {
    conn = await getConnection();
    if (paidDate) {
      await conn.execute(
        `INSERT INTO INSTALLMENTS (UNIT_ID, DUE_DATE, AMOUNT, PAID_AMOUNT, PAID_DATE, STATUS, NOTES, CREATED_BY)
         VALUES (:1, TO_DATE(:2,'YYYY-MM-DD'), :3, :4, TO_DATE(:5,'YYYY-MM-DD'), :6, :7, :8)`,
        [unitId, dueDate, amount, paidAmountVal, paidDate, resolvedStatus, notes || null, sess["username"] || "ADMIN"],
        { autoCommit: true },
      );
    } else {
      await conn.execute(
        `INSERT INTO INSTALLMENTS (UNIT_ID, DUE_DATE, AMOUNT, PAID_AMOUNT, PAID_DATE, STATUS, NOTES, CREATED_BY)
         VALUES (:1, TO_DATE(:2,'YYYY-MM-DD'), :3, :4, NULL, :5, :6, :7)`,
        [unitId, dueDate, amount, paidAmountVal, resolvedStatus, notes || null, sess["username"] || "ADMIN"],
        { autoCommit: true },
      );
    }
    res.status(201).json({ message: "Installment created" });
  } catch (err) {
    req.log.error({ err }, "Create installment error");
    res.status(500).json({ error: "Failed to create installment" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// PUT /api/installments/:id
router.put("/installments/:id", requireAdmin, async (req, res) => {
  const { dueDate, amount, paidAmount, paidDate, status, notes } = req.body;
  if (!dueDate || amount === undefined || amount === null || amount === "") {
    res.status(400).json({ error: "dueDate and amount are required" }); return;
  }
  const sess = req.session as Record<string, unknown>;
  const paidAmountVal = paidAmount != null && paidAmount !== "" ? Number(paidAmount) : 0;
  const resolvedStatus = status || "PENDING";
  let conn;
  try {
    conn = await getConnection();
    let r;
    if (paidDate) {
      r = await conn.execute(
        `UPDATE INSTALLMENTS
         SET DUE_DATE=TO_DATE(:1,'YYYY-MM-DD'), AMOUNT=:2, PAID_AMOUNT=:3,
             PAID_DATE=TO_DATE(:4,'YYYY-MM-DD'), STATUS=:5, NOTES=:6,
             UPDATED_BY=:7, UPDATED_DATE=SYSDATE
         WHERE INSTALLMENT_ID=:8`,
        [dueDate, amount, paidAmountVal, paidDate, resolvedStatus, notes || null, sess["username"] || "ADMIN", req.params["id"]],
        { autoCommit: true },
      );
    } else {
      r = await conn.execute(
        `UPDATE INSTALLMENTS
         SET DUE_DATE=TO_DATE(:1,'YYYY-MM-DD'), AMOUNT=:2, PAID_AMOUNT=:3,
             PAID_DATE=NULL, STATUS=:4, NOTES=:5,
             UPDATED_BY=:6, UPDATED_DATE=SYSDATE
         WHERE INSTALLMENT_ID=:7`,
        [dueDate, amount, paidAmountVal, resolvedStatus, notes || null, sess["username"] || "ADMIN", req.params["id"]],
        { autoCommit: true },
      );
    }
    if ((r.rowsAffected ?? 0) === 0) { res.status(404).json({ error: "Installment not found" }); return; }
    res.json({ message: "Installment updated" });
  } catch (err) {
    req.log.error({ err }, "Update installment error");
    res.status(500).json({ error: "Failed to update installment" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// POST /api/installments/generate — delete existing and create a monthly schedule
router.post("/installments/generate", requireAdmin, async (req, res) => {
  const { unitId, totalAmount, startDate, numberOfMonths } = req.body;
  if (!unitId || !totalAmount || !startDate || !numberOfMonths) {
    res.status(400).json({ error: "unitId, totalAmount, startDate, numberOfMonths are required" }); return;
  }
  const months = Number(numberOfMonths);
  const total = Number(totalAmount);
  if (months < 1 || months > 360) { res.status(400).json({ error: "numberOfMonths must be 1-360" }); return; }
  if (total <= 0) { res.status(400).json({ error: "totalAmount must be > 0" }); return; }
  const parts = String(startDate).split("-");
  const yr = Number(parts[0]);
  const mo = Number(parts[1]);
  if (!yr || !mo || mo < 1 || mo > 12) { res.status(400).json({ error: "startDate must be YYYY-MM" }); return; }
  const sess = req.session as Record<string, unknown>;
  const monthly = Math.round((total / months) * 100) / 100;
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(`DELETE FROM INSTALLMENTS WHERE UNIT_ID = :1`, [unitId], { autoCommit: false });
    for (let i = 0; i < months; i++) {
      const d = new Date(yr, mo - 1 + i, 1);
      const dueDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      const amount = i === months - 1 ? Math.round((total - monthly * (months - 1)) * 100) / 100 : monthly;
      await conn.execute(
        `INSERT INTO INSTALLMENTS (UNIT_ID, DUE_DATE, AMOUNT, PAID_AMOUNT, PAID_DATE, STATUS, NOTES, CREATED_BY)
         VALUES (:1, TO_DATE(:2,'YYYY-MM-DD'), :3, 0, NULL, 'PENDING', NULL, :4)`,
        [unitId, dueDate, amount, sess["username"] || "ADMIN"],
        { autoCommit: false },
      );
    }
    await conn.commit();
    res.json({ message: "Schedule generated", created: months });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    req.log.error({ err }, "Generate installments error");
    res.status(500).json({ error: "Failed to generate installments" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// DELETE /api/installments/:id
router.delete("/installments/:id", requireAdmin, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const r = await conn.execute(`DELETE FROM INSTALLMENTS WHERE INSTALLMENT_ID=:1`, [req.params["id"]], { autoCommit: true });
    if ((r.rowsAffected ?? 0) === 0) { res.status(404).json({ error: "Installment not found" }); return; }
    res.json({ message: "Installment deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete installment error");
    res.status(500).json({ error: "Failed to delete installment" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

export default router;
