import { Router } from "express";
import { getConnection, oracledb } from "../lib/oracle";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

// GET /api/unit-types
router.get("/unit-types", requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT TYPE_ID, TYPE_NAME, DESCRIPTION, CREATED_BY, CREATED_DATE FROM UNIT_TYPES ORDER BY TYPE_ID`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    res.json(result.rows ?? []);
  } catch (err) {
    req.log.error({ err }, "Get unit types error");
    res.status(500).json({ error: "Failed to fetch unit types" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// GET /api/unit-types/:id
router.get("/unit-types/:id", requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT TYPE_ID, TYPE_NAME, DESCRIPTION, CREATED_BY, CREATED_DATE FROM UNIT_TYPES WHERE TYPE_ID = :1`,
      [req.params["id"]],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const rows = result.rows as unknown[];
    if (!rows?.length) { res.status(404).json({ error: "Unit type not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    req.log.error({ err }, "Get unit type error");
    res.status(500).json({ error: "Failed to fetch unit type" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// POST /api/unit-types
router.post("/unit-types", requireAdmin, async (req, res) => {
  const { typeName, description } = req.body;
  if (!typeName) { res.status(400).json({ error: "typeName is required" }); return; }
  const sess = req.session as Record<string, unknown>;
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `INSERT INTO UNIT_TYPES (TYPE_NAME, DESCRIPTION, CREATED_BY) VALUES (:1, :2, :3)`,
      [typeName, description || null, sess["username"] || "ADMIN"],
      { autoCommit: true },
    );
    res.status(201).json({ message: "Unit type created" });
  } catch (err: unknown) {
    const e = err as { errorNum?: number };
    if (e.errorNum === 1) { res.status(409).json({ error: "Unit type name already exists" }); return; }
    req.log.error({ err }, "Create unit type error");
    res.status(500).json({ error: "Failed to create unit type" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// PUT /api/unit-types/:id
router.put("/unit-types/:id", requireAdmin, async (req, res) => {
  const { typeName, description } = req.body;
  if (!typeName) { res.status(400).json({ error: "typeName is required" }); return; }
  const sess = req.session as Record<string, unknown>;
  let conn;
  try {
    conn = await getConnection();
    const r = await conn.execute(
      `UPDATE UNIT_TYPES SET TYPE_NAME=:1, DESCRIPTION=:2, UPDATED_BY=:3, UPDATED_DATE=SYSDATE WHERE TYPE_ID=:4`,
      [typeName, description || null, sess["username"] || "ADMIN", req.params["id"]],
      { autoCommit: true },
    );
    if ((r.rowsAffected ?? 0) === 0) { res.status(404).json({ error: "Unit type not found" }); return; }
    res.json({ message: "Unit type updated" });
  } catch (err) {
    req.log.error({ err }, "Update unit type error");
    res.status(500).json({ error: "Failed to update unit type" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// DELETE /api/unit-types/:id
router.delete("/unit-types/:id", requireAdmin, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    // Check if used by units
    const chk = await conn.execute<[number]>(
      `SELECT COUNT(*) FROM UNITS WHERE TYPE_ID = :1`, [req.params["id"]],
    );
    if ((chk.rows?.[0]?.[0] ?? 0) > 0) {
      res.status(409).json({ error: "Cannot delete: unit type is used by existing units" }); return;
    }
    const r = await conn.execute(
      `DELETE FROM UNIT_TYPES WHERE TYPE_ID = :1`, [req.params["id"]], { autoCommit: true },
    );
    if ((r.rowsAffected ?? 0) === 0) { res.status(404).json({ error: "Unit type not found" }); return; }
    res.json({ message: "Unit type deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete unit type error");
    res.status(500).json({ error: "Failed to delete unit type" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

export default router;
