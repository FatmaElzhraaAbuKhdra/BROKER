import { Router } from "express";
import { getConnection, oracledb } from "../lib/oracle";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

// GET /api/buildings
router.get("/buildings", requireAuth, async (req, res) => {
  const { projectId } = req.query;
  let conn;
  try {
    conn = await getConnection();
    const sql = projectId
      ? `SELECT b.BUILDING_ID, b.PROJECT_ID, b.BUILDING_NAME, b.BUILDING_CODE, b.FLOORS_COUNT, b.LAND_AREA, b.TOTAL_SALEABLE_AREA, b.DESCRIPTION, p.PROJECT_NAME, b.CREATED_DATE
         FROM BUILDINGS b JOIN PROJECTS p ON b.PROJECT_ID=p.PROJECT_ID WHERE b.PROJECT_ID=:1 ORDER BY b.BUILDING_ID`
      : `SELECT b.BUILDING_ID, b.PROJECT_ID, b.BUILDING_NAME, b.BUILDING_CODE, b.FLOORS_COUNT, b.LAND_AREA, b.TOTAL_SALEABLE_AREA, b.DESCRIPTION, p.PROJECT_NAME, b.CREATED_DATE
         FROM BUILDINGS b JOIN PROJECTS p ON b.PROJECT_ID=p.PROJECT_ID ORDER BY b.BUILDING_ID`;
    const params = projectId ? [projectId] : [];
    const result = await conn.execute(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    res.json(result.rows ?? []);
  } catch (err) {
    req.log.error({ err }, "Get buildings error");
    res.status(500).json({ error: "Failed to fetch buildings" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// GET /api/buildings/:id
router.get("/buildings/:id", requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT b.BUILDING_ID, b.PROJECT_ID, b.BUILDING_NAME, b.BUILDING_CODE, b.FLOORS_COUNT, b.LAND_AREA, b.TOTAL_SALEABLE_AREA, b.DESCRIPTION, p.PROJECT_NAME
       FROM BUILDINGS b JOIN PROJECTS p ON b.PROJECT_ID=p.PROJECT_ID WHERE b.BUILDING_ID=:1`,
      [req.params["id"]], { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const rows = result.rows as unknown[];
    if (!rows?.length) { res.status(404).json({ error: "Building not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    req.log.error({ err }, "Get building error");
    res.status(500).json({ error: "Failed to fetch building" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// POST /api/buildings
router.post("/buildings", requireAdmin, async (req, res) => {
  const { projectId, buildingName, buildingCode, floorsCount, landArea, totalSaleableArea, description } = req.body;
  if (!projectId || !buildingName) { res.status(400).json({ error: "projectId and buildingName are required" }); return; }
  const sess = req.session as Record<string, unknown>;
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `INSERT INTO BUILDINGS (PROJECT_ID, BUILDING_NAME, BUILDING_CODE, FLOORS_COUNT, LAND_AREA, TOTAL_SALEABLE_AREA, DESCRIPTION, CREATED_BY) VALUES (:1,:2,:3,:4,:5,:6,:7,:8)`,
      [projectId, buildingName, buildingCode || null, floorsCount || 0, landArea || null, totalSaleableArea || null, description || null, sess["username"] || "ADMIN"],
      { autoCommit: true },
    );
    res.status(201).json({ message: "Building created" });
  } catch (err) {
    req.log.error({ err }, "Create building error");
    res.status(500).json({ error: "Failed to create building" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// PUT /api/buildings/:id
router.put("/buildings/:id", requireAdmin, async (req, res) => {
  const { projectId, buildingName, buildingCode, floorsCount, landArea, totalSaleableArea, description } = req.body;
  if (!buildingName) { res.status(400).json({ error: "buildingName is required" }); return; }
  const sess = req.session as Record<string, unknown>;
  let conn;
  try {
    conn = await getConnection();
    const r = await conn.execute(
      `UPDATE BUILDINGS SET PROJECT_ID=:1, BUILDING_NAME=:2, BUILDING_CODE=:3, FLOORS_COUNT=:4, LAND_AREA=:5, TOTAL_SALEABLE_AREA=:6, DESCRIPTION=:7, UPDATED_BY=:8, UPDATED_DATE=SYSDATE WHERE BUILDING_ID=:9`,
      [projectId, buildingName, buildingCode || null, floorsCount || 0, landArea || null, totalSaleableArea || null, description || null, sess["username"] || "ADMIN", req.params["id"]],
      { autoCommit: true },
    );
    if ((r.rowsAffected ?? 0) === 0) { res.status(404).json({ error: "Building not found" }); return; }
    res.json({ message: "Building updated" });
  } catch (err) {
    req.log.error({ err }, "Update building error");
    res.status(500).json({ error: "Failed to update building" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// DELETE /api/buildings/:id
router.delete("/buildings/:id", requireAdmin, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const chk = await conn.execute<[number]>(`SELECT COUNT(*) FROM FLOORS WHERE BUILDING_ID=:1`, [req.params["id"]]);
    if ((chk.rows?.[0]?.[0] ?? 0) > 0) {
      res.status(409).json({ error: "Cannot delete: building has associated floors" }); return;
    }
    const r = await conn.execute(`DELETE FROM BUILDINGS WHERE BUILDING_ID=:1`, [req.params["id"]], { autoCommit: true });
    if ((r.rowsAffected ?? 0) === 0) { res.status(404).json({ error: "Building not found" }); return; }
    res.json({ message: "Building deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete building error");
    res.status(500).json({ error: "Failed to delete building" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

export default router;
