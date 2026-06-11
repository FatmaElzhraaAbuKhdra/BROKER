import { Router } from "express";
import { getConnection, oracledb } from "../lib/oracle";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

const VILLA_SELECT = `
  SELECT v.VILLA_ID, v.PROJECT_ID, v.VILLA_CODE, v.VILLA_NAME,
         v.AREA, v.LAND_AREA, v.ROOMS, v.BATHROOMS, v.PRICE,
         v.STATUS, v.DESCRIPTION, v.CREATED_BY, v.CREATED_DATE,
         p.PROJECT_NAME
  FROM VILLAS v
  JOIN PROJECTS p ON v.PROJECT_ID = p.PROJECT_ID
`;

// GET /api/villas
router.get("/villas", requireAuth, async (req, res) => {
  const { status, projectId, search } = req.query;
  let conn;
  try {
    conn = await getConnection();
    let sql = VILLA_SELECT + ` WHERE 1=1`;
    const params: unknown[] = [];
    let idx = 1;
    if (status && status !== "ALL") { sql += ` AND v.STATUS = :${idx++}`; params.push(status); }
    if (projectId) { sql += ` AND v.PROJECT_ID = :${idx++}`; params.push(projectId); }
    if (search) {
      sql += ` AND (UPPER(v.VILLA_CODE) LIKE UPPER(:${idx}) OR UPPER(v.VILLA_NAME) LIKE UPPER(:${idx + 1}))`;
      params.push(`%${search}%`, `%${search}%`);
      idx += 2;
    }
    sql += ` ORDER BY v.VILLA_ID`;
    const result = await conn.execute(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    res.json(result.rows ?? []);
  } catch (err) {
    req.log.error({ err }, "Get villas error");
    res.status(500).json({ error: "Failed to fetch villas" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// GET /api/villas/:id
router.get("/villas/:id", requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      VILLA_SELECT + ` WHERE v.VILLA_ID = :1`,
      [req.params["id"]], { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const rows = result.rows as unknown[];
    if (!rows?.length) { res.status(404).json({ error: "Villa not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    req.log.error({ err }, "Get villa error");
    res.status(500).json({ error: "Failed to fetch villa" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// POST /api/villas
router.post("/villas", requireAdmin, async (req, res) => {
  const { projectId, villaCode, villaName, area, landArea, rooms, bathrooms, price, description } = req.body;
  if (!projectId || !villaCode || !villaName || !area || price === undefined || price === null || price === "") {
    res.status(400).json({ error: "projectId, villaCode, villaName, area, price are required" }); return;
  }
  if (Number(area) <= 0) { res.status(400).json({ error: "Area must be greater than 0" }); return; }
  const sess = req.session as Record<string, unknown>;
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `INSERT INTO VILLAS (PROJECT_ID, VILLA_CODE, VILLA_NAME, AREA, LAND_AREA, ROOMS, BATHROOMS, PRICE, STATUS, DESCRIPTION, CREATED_BY)
       VALUES (:1,:2,:3,:4,:5,:6,:7,:8,'AVAILABLE',:9,:10)`,
      [projectId, villaCode, villaName, area, landArea || null, rooms || 0, bathrooms || 0, price, description || null, sess["username"] || "ADMIN"],
      { autoCommit: true },
    );
    res.status(201).json({ message: "Villa created" });
  } catch (err: unknown) {
    const e = err as { errorNum?: number };
    if (e.errorNum === 1) { res.status(409).json({ error: "Villa code already exists" }); return; }
    req.log.error({ err }, "Create villa error");
    res.status(500).json({ error: "Failed to create villa" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// PUT /api/villas/:id
router.put("/villas/:id", requireAdmin, async (req, res) => {
  const { projectId, villaCode, villaName, area, landArea, rooms, bathrooms, price, status, description } = req.body;
  if (!villaName || price === undefined || price === null || price === "") {
    res.status(400).json({ error: "villaName and price are required" }); return;
  }
  if (Number(area) <= 0) { res.status(400).json({ error: "Area must be greater than 0" }); return; }
  const sess = req.session as Record<string, unknown>;
  let conn;
  try {
    conn = await getConnection();
    const chk = await conn.execute<[string]>(`SELECT STATUS FROM VILLAS WHERE VILLA_ID=:1`, [req.params["id"]]);
    if ((chk.rows?.[0]?.[0] ?? "") === "SOLD") {
      res.status(403).json({ error: "Cannot edit a SOLD villa" }); return;
    }
    const r = await conn.execute(
      `UPDATE VILLAS SET PROJECT_ID=:1, VILLA_CODE=:2, VILLA_NAME=:3, AREA=:4, LAND_AREA=:5,
       ROOMS=:6, BATHROOMS=:7, PRICE=:8, STATUS=:9, DESCRIPTION=:10, UPDATED_BY=:11, UPDATED_DATE=SYSDATE
       WHERE VILLA_ID=:12`,
      [projectId, villaCode, villaName, area, landArea || null, rooms || 0, bathrooms || 0, price, status || "AVAILABLE", description || null, sess["username"] || "ADMIN", req.params["id"]],
      { autoCommit: true },
    );
    if ((r.rowsAffected ?? 0) === 0) { res.status(404).json({ error: "Villa not found" }); return; }
    res.json({ message: "Villa updated" });
  } catch (err) {
    req.log.error({ err }, "Update villa error");
    res.status(500).json({ error: "Failed to update villa" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// DELETE /api/villas/:id
router.delete("/villas/:id", requireAdmin, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const chk = await conn.execute<[string]>(`SELECT STATUS FROM VILLAS WHERE VILLA_ID=:1`, [req.params["id"]]);
    if ((chk.rows?.[0]?.[0] ?? "") === "SOLD") {
      res.status(403).json({ error: "Cannot delete a SOLD villa" }); return;
    }
    const unitChk = await conn.execute<[number]>(`SELECT COUNT(*) FROM UNITS WHERE VILLA_ID=:1`, [req.params["id"]]);
    if ((unitChk.rows?.[0]?.[0] ?? 0) > 0) {
      res.status(409).json({ error: "Cannot delete: villa has associated units" }); return;
    }
    const r = await conn.execute(`DELETE FROM VILLAS WHERE VILLA_ID=:1`, [req.params["id"]], { autoCommit: true });
    if ((r.rowsAffected ?? 0) === 0) { res.status(404).json({ error: "Villa not found" }); return; }
    res.json({ message: "Villa deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete villa error");
    res.status(500).json({ error: "Failed to delete villa" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

export default router;
