import { Router } from "express";
import { getConnection, oracledb } from "../lib/oracle";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

// GET /api/floors
router.get("/floors", requireAuth, async (req, res) => {
  const { buildingId } = req.query;
  let conn;
  try {
    conn = await getConnection();
    const sql = buildingId
      ? `SELECT f.FLOOR_ID, f.BUILDING_ID, f.FLOOR_NUMBER, f.FLOOR_NAME, f.DESCRIPTION, b.BUILDING_NAME, p.PROJECT_NAME
         FROM FLOORS f JOIN BUILDINGS b ON f.BUILDING_ID=b.BUILDING_ID JOIN PROJECTS p ON b.PROJECT_ID=p.PROJECT_ID
         WHERE f.BUILDING_ID=:1 ORDER BY f.FLOOR_ID`
      : `SELECT f.FLOOR_ID, f.BUILDING_ID, f.FLOOR_NUMBER, f.FLOOR_NAME, f.DESCRIPTION, b.BUILDING_NAME, p.PROJECT_NAME
         FROM FLOORS f JOIN BUILDINGS b ON f.BUILDING_ID=b.BUILDING_ID JOIN PROJECTS p ON b.PROJECT_ID=p.PROJECT_ID
         ORDER BY f.FLOOR_ID`;
    const result = await conn.execute(sql, buildingId ? [buildingId] : [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    res.json(result.rows ?? []);
  } catch (err) {
    req.log.error({ err }, "Get floors error");
    res.status(500).json({ error: "Failed to fetch floors" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// GET /api/floors/:id
router.get("/floors/:id", requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT f.FLOOR_ID, f.BUILDING_ID, f.FLOOR_NUMBER, f.FLOOR_NAME, f.DESCRIPTION, b.BUILDING_NAME, p.PROJECT_NAME
       FROM FLOORS f JOIN BUILDINGS b ON f.BUILDING_ID=b.BUILDING_ID JOIN PROJECTS p ON b.PROJECT_ID=p.PROJECT_ID
       WHERE f.FLOOR_ID=:1`,
      [req.params["id"]], { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const rows = result.rows as unknown[];
    if (!rows?.length) { res.status(404).json({ error: "Floor not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    req.log.error({ err }, "Get floor error");
    res.status(500).json({ error: "Failed to fetch floor" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// POST /api/floors
router.post("/floors", requireAdmin, async (req, res) => {
  const { buildingId, floorNumber, floorName, description } = req.body;
  if (!buildingId || !floorNumber) { res.status(400).json({ error: "buildingId and floorNumber are required" }); return; }
  const sess = req.session as Record<string, unknown>;
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `INSERT INTO FLOORS (BUILDING_ID, FLOOR_NUMBER, FLOOR_NAME, DESCRIPTION, CREATED_BY) VALUES (:1,:2,:3,:4,:5)`,
      [buildingId, floorNumber, floorName || null, description || null, sess["username"] || "ADMIN"],
      { autoCommit: true },
    );
    res.status(201).json({ message: "Floor created" });
  } catch (err) {
    req.log.error({ err }, "Create floor error");
    res.status(500).json({ error: "Failed to create floor" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// PUT /api/floors/:id
router.put("/floors/:id", requireAdmin, async (req, res) => {
  const { buildingId, floorNumber, floorName, description } = req.body;
  if (!floorNumber) { res.status(400).json({ error: "floorNumber is required" }); return; }
  const sess = req.session as Record<string, unknown>;
  let conn;
  try {
    conn = await getConnection();
    const r = await conn.execute(
      `UPDATE FLOORS SET BUILDING_ID=:1, FLOOR_NUMBER=:2, FLOOR_NAME=:3, DESCRIPTION=:4, UPDATED_BY=:5, UPDATED_DATE=SYSDATE WHERE FLOOR_ID=:6`,
      [buildingId, floorNumber, floorName || null, description || null, sess["username"] || "ADMIN", req.params["id"]],
      { autoCommit: true },
    );
    if ((r.rowsAffected ?? 0) === 0) { res.status(404).json({ error: "Floor not found" }); return; }
    res.json({ message: "Floor updated" });
  } catch (err) {
    req.log.error({ err }, "Update floor error");
    res.status(500).json({ error: "Failed to update floor" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// DELETE /api/floors/:id
router.delete("/floors/:id", requireAdmin, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const chk = await conn.execute<[number]>(`SELECT COUNT(*) FROM UNITS WHERE FLOOR_ID=:1`, [req.params["id"]]);
    if ((chk.rows?.[0]?.[0] ?? 0) > 0) {
      res.status(409).json({ error: "Cannot delete: floor has associated units" }); return;
    }
    const r = await conn.execute(`DELETE FROM FLOORS WHERE FLOOR_ID=:1`, [req.params["id"]], { autoCommit: true });
    if ((r.rowsAffected ?? 0) === 0) { res.status(404).json({ error: "Floor not found" }); return; }
    res.json({ message: "Floor deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete floor error");
    res.status(500).json({ error: "Failed to delete floor" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

export default router;
