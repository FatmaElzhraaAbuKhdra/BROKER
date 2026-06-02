import { Router } from "express";
import { getConnection, oracledb } from "../lib/oracle";
import { requireAdmin } from "../middleware/auth";
import bcrypt from "bcryptjs";

const router = Router();

// GET /api/users
router.get("/users", requireAdmin, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT USER_ID, USERNAME, FULL_NAME, EMAIL, ROLE, IS_ACTIVE, CREATED_DATE FROM USERS ORDER BY USER_ID`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    res.json(result.rows ?? []);
  } catch (err) {
    req.log.error({ err }, "Get users error");
    res.status(500).json({ error: "Failed to fetch users" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// PUT /api/users/:id
router.put("/users/:id", requireAdmin, async (req, res) => {
  const { fullName, email, role, isActive, password } = req.body;
  if (!fullName || !role) { res.status(400).json({ error: "fullName and role are required" }); return; }
  const sess = req.session as Record<string, unknown>;
  let conn;
  try {
    conn = await getConnection();
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      await conn.execute(
        `UPDATE USERS SET FULL_NAME=:1, EMAIL=:2, ROLE=:3, IS_ACTIVE=:4, PASSWORD_HASH=:5, UPDATED_BY=:6, UPDATED_DATE=SYSDATE WHERE USER_ID=:7`,
        [fullName, email || null, role, isActive ? 1 : 0, hash, sess["username"] || "ADMIN", req.params["id"]],
        { autoCommit: true },
      );
    } else {
      await conn.execute(
        `UPDATE USERS SET FULL_NAME=:1, EMAIL=:2, ROLE=:3, IS_ACTIVE=:4, UPDATED_BY=:5, UPDATED_DATE=SYSDATE WHERE USER_ID=:6`,
        [fullName, email || null, role, isActive ? 1 : 0, sess["username"] || "ADMIN", req.params["id"]],
        { autoCommit: true },
      );
    }
    res.json({ message: "User updated" });
  } catch (err) {
    req.log.error({ err }, "Update user error");
    res.status(500).json({ error: "Failed to update user" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// DELETE /api/users/:id
router.delete("/users/:id", requireAdmin, async (req, res) => {
  const sess = req.session as Record<string, unknown>;
  if (String(sess["userId"]) === String(req.params["id"])) {
    res.status(400).json({ error: "Cannot delete your own account" }); return;
  }
  let conn;
  try {
    conn = await getConnection();
    const r = await conn.execute(`DELETE FROM USERS WHERE USER_ID=:1`, [req.params["id"]], { autoCommit: true });
    if ((r.rowsAffected ?? 0) === 0) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ message: "User deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete user error");
    res.status(500).json({ error: "Failed to delete user" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

export default router;
