import { Router } from "express";
import { getConnection, oracledb } from "../lib/oracle";
import { requireAuth, requireAdmin } from "../middleware/auth";
import multer from "multer";
import path from "path";
import { mkdirSync } from "fs";
import { unlink } from "fs/promises";

const router = Router();

const uploadsDir = path.resolve(process.cwd(), "uploads");
mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"));
  },
});

const UNIT_SELECT = `
  SELECT u.UNIT_ID, u.UNIT_CODE, u.UNIT_NAME, u.TYPE_ID, u.PROJECT_ID, u.BUILDING_ID, u.FLOOR_ID,
         u.AREA, u.ROOMS, u.BATHROOMS, u.PRICE, u.STATUS, u.DESCRIPTION,
         u.CREATED_BY, u.CREATED_DATE,
         t.TYPE_NAME, p.PROJECT_NAME, b.BUILDING_NAME, f.FLOOR_NUMBER, f.FLOOR_NAME
  FROM UNITS u
  JOIN UNIT_TYPES t ON u.TYPE_ID = t.TYPE_ID
  JOIN PROJECTS p ON u.PROJECT_ID = p.PROJECT_ID
  JOIN BUILDINGS b ON u.BUILDING_ID = b.BUILDING_ID
  JOIN FLOORS f ON u.FLOOR_ID = f.FLOOR_ID
`;

// GET /api/units
router.get("/units", requireAuth, async (req, res) => {
  const { status, typeId, search } = req.query;
  let conn;
  try {
    conn = await getConnection();
    let sql = UNIT_SELECT + ` WHERE 1=1`;
    const params: unknown[] = [];
    let idx = 1;
    if (status && status !== "ALL") { sql += ` AND u.STATUS = :${idx++}`; params.push(status); }
    if (typeId) { sql += ` AND u.TYPE_ID = :${idx++}`; params.push(typeId); }
    if (search) { sql += ` AND (UPPER(u.UNIT_CODE) LIKE UPPER(:${idx}) OR UPPER(u.UNIT_NAME) LIKE UPPER(:${idx + 1}))`; params.push(`%${search}%`, `%${search}%`); idx += 2; }
    sql += ` ORDER BY u.UNIT_ID`;
    const result = await conn.execute(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    res.json(result.rows ?? []);
  } catch (err) {
    req.log.error({ err }, "Get units error");
    res.status(500).json({ error: "Failed to fetch units" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// GET /api/units/:id
router.get("/units/:id", requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      UNIT_SELECT + ` WHERE u.UNIT_ID = :1`,
      [req.params["id"]], { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const rows = result.rows as unknown[];
    if (!rows?.length) { res.status(404).json({ error: "Unit not found" }); return; }

    // Load images
    const imgResult = await conn.execute(
      `SELECT IMAGE_ID, FILE_NAME, FILE_PATH, MIME_TYPE, FILE_SIZE, IS_PRIMARY FROM UNIT_IMAGES WHERE UNIT_ID=:1 ORDER BY IS_PRIMARY DESC, IMAGE_ID`,
      [req.params["id"]], { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    const unit = rows[0] as Record<string, unknown>;
    unit["IMAGES"] = imgResult.rows ?? [];
    res.json(unit);
  } catch (err) {
    req.log.error({ err }, "Get unit error");
    res.status(500).json({ error: "Failed to fetch unit" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// POST /api/units
router.post("/units", requireAdmin, async (req, res) => {
  const { unitCode, unitName, typeId, projectId, buildingId, floorId, area, rooms, bathrooms, price, description } = req.body;
  if (!unitCode || !unitName || !typeId || !projectId || !buildingId || !floorId || !area || !price) {
    res.status(400).json({ error: "unitCode, unitName, typeId, projectId, buildingId, floorId, area, price are required" }); return;
  }
  if (Number(price) <= 0) { res.status(400).json({ error: "Price must be greater than 0" }); return; }
  if (Number(area) <= 0) { res.status(400).json({ error: "Area must be greater than 0" }); return; }
  const sess = req.session as Record<string, unknown>;
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `INSERT INTO UNITS (UNIT_CODE, UNIT_NAME, TYPE_ID, PROJECT_ID, BUILDING_ID, FLOOR_ID, AREA, ROOMS, BATHROOMS, PRICE, STATUS, DESCRIPTION, CREATED_BY)
       VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,'AVAILABLE',:11,:12)`,
      [unitCode, unitName, typeId, projectId, buildingId, floorId, area, rooms || 0, bathrooms || 0, price, description || null, sess["username"] || "ADMIN"],
      { autoCommit: true },
    );
    res.status(201).json({ message: "Unit created" });
  } catch (err: unknown) {
    const e = err as { errorNum?: number };
    if (e.errorNum === 1) { res.status(409).json({ error: "Unit code already exists" }); return; }
    req.log.error({ err }, "Create unit error");
    res.status(500).json({ error: "Failed to create unit" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// PUT /api/units/:id
router.put("/units/:id", requireAdmin, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    // Check if SOLD
    const chk = await conn.execute<[string]>(`SELECT STATUS FROM UNITS WHERE UNIT_ID=:1`, [req.params["id"]]);
    if ((chk.rows?.[0]?.[0] ?? "") === "SOLD") {
      res.status(403).json({ error: "Cannot edit a SOLD unit" }); return;
    }
    const { unitCode, unitName, typeId, projectId, buildingId, floorId, area, rooms, bathrooms, price, status, description } = req.body;
    if (!unitName || !price) { res.status(400).json({ error: "unitName and price are required" }); return; }
    if (Number(price) <= 0) { res.status(400).json({ error: "Price must be greater than 0" }); return; }
    const sess = req.session as Record<string, unknown>;
    const r = await conn.execute(
      `UPDATE UNITS SET UNIT_CODE=:1, UNIT_NAME=:2, TYPE_ID=:3, PROJECT_ID=:4, BUILDING_ID=:5, FLOOR_ID=:6,
       AREA=:7, ROOMS=:8, BATHROOMS=:9, PRICE=:10, STATUS=:11, DESCRIPTION=:12, UPDATED_BY=:13, UPDATED_DATE=SYSDATE
       WHERE UNIT_ID=:14`,
      [unitCode, unitName, typeId, projectId, buildingId, floorId, area, rooms || 0, bathrooms || 0, price, status || "AVAILABLE", description || null, sess["username"] || "ADMIN", req.params["id"]],
      { autoCommit: true },
    );
    if ((r.rowsAffected ?? 0) === 0) { res.status(404).json({ error: "Unit not found" }); return; }
    res.json({ message: "Unit updated" });
  } catch (err) {
    req.log.error({ err }, "Update unit error");
    res.status(500).json({ error: "Failed to update unit" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// DELETE /api/units/:id
router.delete("/units/:id", requireAdmin, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const chk = await conn.execute<[string]>(`SELECT STATUS FROM UNITS WHERE UNIT_ID=:1`, [req.params["id"]]);
    if ((chk.rows?.[0]?.[0] ?? "") === "SOLD") {
      res.status(403).json({ error: "Cannot delete a SOLD unit" }); return;
    }
    const r = await conn.execute(`DELETE FROM UNITS WHERE UNIT_ID=:1`, [req.params["id"]], { autoCommit: true });
    if ((r.rowsAffected ?? 0) === 0) { res.status(404).json({ error: "Unit not found" }); return; }
    res.json({ message: "Unit deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete unit error");
    res.status(500).json({ error: "Failed to delete unit" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// POST /api/units/:id/images — upload images
router.post("/units/:id/images", requireAuth, upload.array("images", 10), async (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files?.length) { res.status(400).json({ error: "No images uploaded" }); return; }
  const sess = req.session as Record<string, unknown>;
  let conn;
  try {
    conn = await getConnection();
    // Check unit exists
    const chk = await conn.execute<[number]>(`SELECT COUNT(*) FROM UNITS WHERE UNIT_ID=:1`, [req.params["id"]]);
    if ((chk.rows?.[0]?.[0] ?? 0) === 0) { res.status(404).json({ error: "Unit not found" }); return; }

    // Check if this unit already has images (first upload makes first image primary)
    const existingCount = await conn.execute<[number]>(`SELECT COUNT(*) FROM UNIT_IMAGES WHERE UNIT_ID=:1`, [req.params["id"]]);
    const isFirstUpload = (existingCount.rows?.[0]?.[0] ?? 0) === 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isPrimary = isFirstUpload && i === 0 ? 1 : 0;
      await conn.execute(
        `INSERT INTO UNIT_IMAGES (UNIT_ID, FILE_NAME, FILE_PATH, MIME_TYPE, FILE_SIZE, IS_PRIMARY, CREATED_BY) VALUES (:1,:2,:3,:4,:5,:6,:7)`,
        [req.params["id"], file.originalname, file.filename, file.mimetype, file.size, isPrimary, sess["username"] || "USER"],
        { autoCommit: false },
      );
    }
    await conn.commit();
    res.status(201).json({ message: `${files.length} image(s) uploaded` });
  } catch (err) {
    // Cleanup uploaded files on error
    for (const f of files) {
      await unlink(path.join(uploadsDir, f.filename)).catch(() => {});
    }
    req.log.error({ err }, "Upload images error");
    res.status(500).json({ error: "Failed to upload images" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// GET /api/units/:id/images
router.get("/units/:id/images", requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT IMAGE_ID, UNIT_ID, FILE_NAME, FILE_PATH, MIME_TYPE, FILE_SIZE, IS_PRIMARY, CREATED_DATE FROM UNIT_IMAGES WHERE UNIT_ID=:1 ORDER BY IS_PRIMARY DESC, IMAGE_ID`,
      [req.params["id"]], { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    res.json(result.rows ?? []);
  } catch (err) {
    req.log.error({ err }, "Get images error");
    res.status(500).json({ error: "Failed to fetch images" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// DELETE /api/units/:id/images/:imageId
router.delete("/units/:id/images/:imageId", requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const imgResult = await conn.execute<[string]>(
      `SELECT FILE_PATH FROM UNIT_IMAGES WHERE IMAGE_ID=:1 AND UNIT_ID=:2`,
      [req.params["imageId"], req.params["id"]],
    );
    if (!imgResult.rows?.length) { res.status(404).json({ error: "Image not found" }); return; }
    const filePath = imgResult.rows[0][0];
    await conn.execute(`DELETE FROM UNIT_IMAGES WHERE IMAGE_ID=:1`, [req.params["imageId"]], { autoCommit: true });
    // Delete physical file
    await unlink(path.join(uploadsDir, filePath)).catch(() => {});
    res.json({ message: "Image deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete image error");
    res.status(500).json({ error: "Failed to delete image" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// PUT /api/units/:id/images/:imageId/primary
router.put("/units/:id/images/:imageId/primary", requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(`UPDATE UNIT_IMAGES SET IS_PRIMARY=0 WHERE UNIT_ID=:1`, [req.params["id"]], { autoCommit: false });
    const r = await conn.execute(`UPDATE UNIT_IMAGES SET IS_PRIMARY=1 WHERE IMAGE_ID=:1 AND UNIT_ID=:2`, [req.params["imageId"], req.params["id"]], { autoCommit: false });
    if ((r.rowsAffected ?? 0) === 0) { await conn.rollback(); res.status(404).json({ error: "Image not found" }); return; }
    await conn.commit();
    res.json({ message: "Primary image updated" });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    req.log.error({ err }, "Set primary image error");
    res.status(500).json({ error: "Failed to set primary image" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

export default router;
