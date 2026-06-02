import { Router } from "express";
import { getConnection, oracledb } from "../lib/oracle";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

// GET /api/projects
router.get("/projects", requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT PROJECT_ID, PROJECT_NAME, LOCATION, DESCRIPTION, START_DATE, END_DATE, STATUS, CREATED_DATE FROM PROJECTS ORDER BY PROJECT_ID`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    res.json(result.rows ?? []);
  } catch (err) {
    req.log.error({ err }, "Get projects error");
    res.status(500).json({ error: "Failed to fetch projects" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// GET /api/projects/:id
router.get("/projects/:id", requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT PROJECT_ID, PROJECT_NAME, LOCATION, DESCRIPTION, START_DATE, END_DATE, STATUS, CREATED_DATE FROM PROJECTS WHERE PROJECT_ID = :1`,
      [req.params["id"]], { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const rows = result.rows as unknown[];
    if (!rows?.length) { res.status(404).json({ error: "Project not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    req.log.error({ err }, "Get project error");
    res.status(500).json({ error: "Failed to fetch project" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// POST /api/projects
router.post("/projects", requireAdmin, async (req, res) => {
  const { projectName, location, description, startDate, endDate, status } = req.body;
  if (!projectName) { res.status(400).json({ error: "projectName is required" }); return; }
  const sess = req.session as Record<string, unknown>;
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `INSERT INTO PROJECTS (PROJECT_NAME, LOCATION, DESCRIPTION, START_DATE, END_DATE, STATUS, CREATED_BY)
       VALUES (:1, :2, :3, TO_DATE(:4,'YYYY-MM-DD'), TO_DATE(:5,'YYYY-MM-DD'), :6, :7)`,
      [projectName, location || null, description || null, startDate || null, endDate || null, status || "ACTIVE", sess["username"] || "ADMIN"],
      { autoCommit: true },
    );
    res.status(201).json({ message: "Project created" });
  } catch (err) {
    req.log.error({ err }, "Create project error");
    res.status(500).json({ error: "Failed to create project" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// PUT /api/projects/:id
router.put("/projects/:id", requireAdmin, async (req, res) => {
  const { projectName, location, description, startDate, endDate, status } = req.body;
  if (!projectName) { res.status(400).json({ error: "projectName is required" }); return; }
  const sess = req.session as Record<string, unknown>;
  let conn;
  try {
    conn = await getConnection();
    const r = await conn.execute(
      `UPDATE PROJECTS SET PROJECT_NAME=:1, LOCATION=:2, DESCRIPTION=:3,
       START_DATE=TO_DATE(:4,'YYYY-MM-DD'), END_DATE=TO_DATE(:5,'YYYY-MM-DD'),
       STATUS=:6, UPDATED_BY=:7, UPDATED_DATE=SYSDATE WHERE PROJECT_ID=:8`,
      [projectName, location || null, description || null, startDate || null, endDate || null, status || "ACTIVE", sess["username"] || "ADMIN", req.params["id"]],
      { autoCommit: true },
    );
    if ((r.rowsAffected ?? 0) === 0) { res.status(404).json({ error: "Project not found" }); return; }
    res.json({ message: "Project updated" });
  } catch (err) {
    req.log.error({ err }, "Update project error");
    res.status(500).json({ error: "Failed to update project" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// DELETE /api/projects/:id
router.delete("/projects/:id", requireAdmin, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const chk = await conn.execute<[number]>(`SELECT COUNT(*) FROM BUILDINGS WHERE PROJECT_ID=:1`, [req.params["id"]]);
    if ((chk.rows?.[0]?.[0] ?? 0) > 0) {
      res.status(409).json({ error: "Cannot delete: project has associated buildings" }); return;
    }
    const r = await conn.execute(`DELETE FROM PROJECTS WHERE PROJECT_ID=:1`, [req.params["id"]], { autoCommit: true });
    if ((r.rowsAffected ?? 0) === 0) { res.status(404).json({ error: "Project not found" }); return; }
    res.json({ message: "Project deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete project error");
    res.status(500).json({ error: "Failed to delete project" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

export default router;
