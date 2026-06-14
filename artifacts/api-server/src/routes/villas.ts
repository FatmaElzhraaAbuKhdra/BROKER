import { Router } from "express";
import { getConnection, oracledb } from "../lib/oracle";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

const VILLA_SELECT = `
  SELECT v.VILLA_ID, v.PROJECT_ID, v.VILLA_CODE, v.VILLA_NAME,
         v.AREA, v.LAND_AREA, v.ROOMS, v.BATHROOMS, v.PRICE,
         v.STATUS, v.DESCRIPTION, v.CREATED_BY, v.CREATED_DATE,
         p.PROJECT_NAME,
         NVL(us.TOTAL_UNITS, 0) AS TOTAL_UNITS,
         NVL(us.SOLD_UNITS, 0) AS SOLD_UNITS,
         NVL(us.AVAILABLE_UNITS, 0) AS AVAILABLE_UNITS
  FROM VILLAS v
  JOIN PROJECTS p ON v.PROJECT_ID = p.PROJECT_ID
  LEFT JOIN (
    SELECT VILLA_ID,
           COUNT(*) AS TOTAL_UNITS,
           SUM(CASE WHEN STATUS = 'SOLD' THEN 1 ELSE 0 END) AS SOLD_UNITS,
           SUM(CASE WHEN STATUS = 'AVAILABLE' THEN 1 ELSE 0 END) AS AVAILABLE_UNITS
    FROM UNITS
    WHERE VILLA_ID IS NOT NULL
    GROUP BY VILLA_ID
  ) us ON us.VILLA_ID = v.VILLA_ID
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

// GET /api/villas/:id/units
router.get("/villas/:id/units", requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT u.UNIT_ID, u.UNIT_CODE, u.UNIT_NAME, u.TYPE_ID, u.PROJECT_ID, u.BUILDING_ID, u.FLOOR_ID,
              u.AREA, u.SALEABLE_AREA, u.ROOMS, u.BATHROOMS,
              CASE WHEN u.STATUS = 'SOLD' THEN NVL(s.SALE_AMOUNT, u.PRICE) ELSE u.PRICE END AS PRICE,
              u.STATUS, u.DESCRIPTION, u.VILLA_ID,
              u.CREATED_BY, u.CREATED_DATE,
              t.TYPE_NAME, p.PROJECT_NAME, b.BUILDING_NAME, f.FLOOR_NUMBER, f.FLOOR_NAME, f.FLOOR_TYPE
       FROM UNITS u
       JOIN UNIT_TYPES t ON u.TYPE_ID = t.TYPE_ID
       JOIN PROJECTS p ON u.PROJECT_ID = p.PROJECT_ID
       JOIN BUILDINGS b ON u.BUILDING_ID = b.BUILDING_ID
       JOIN FLOORS f ON u.FLOOR_ID = f.FLOOR_ID
       LEFT JOIN (SELECT UNIT_ID, MAX(SALE_AMOUNT) AS SALE_AMOUNT FROM SALES GROUP BY UNIT_ID) s
         ON s.UNIT_ID = u.UNIT_ID
       WHERE u.VILLA_ID = :1
       ORDER BY u.UNIT_ID`,
      [req.params["id"]], { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    res.json(result.rows ?? []);
  } catch (err) {
    req.log.error({ err }, "Get villa units error");
    res.status(500).json({ error: "Failed to fetch villa units" });
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
    const currentStatus = chk.rows?.[0]?.[0] ?? "";
    if (currentStatus === "SOLD") {
      res.status(403).json({ error: "Cannot edit a SOLD villa" }); return;
    }
    const allowedStatuses = ["AVAILABLE", "RESERVED", "PARTIALLY_SOLD", "SOLD"];
    const newStatus = allowedStatuses.includes(status) ? status : "AVAILABLE";
    const r = await conn.execute(
      `UPDATE VILLAS SET PROJECT_ID=:1, VILLA_CODE=:2, VILLA_NAME=:3, AREA=:4, LAND_AREA=:5,
       ROOMS=:6, BATHROOMS=:7, PRICE=:8, STATUS=:9, DESCRIPTION=:10, UPDATED_BY=:11, UPDATED_DATE=SYSDATE
       WHERE VILLA_ID=:12`,
      [projectId, villaCode, villaName, area, landArea || null, rooms || 0, bathrooms || 0, price, newStatus, description || null, sess["username"] || "ADMIN", req.params["id"]],
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
    const delStatus = chk.rows?.[0]?.[0] ?? "";
    if (delStatus === "SOLD" || delStatus === "PARTIALLY_SOLD") {
      res.status(403).json({ error: "Cannot delete a sold villa" }); return;
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
