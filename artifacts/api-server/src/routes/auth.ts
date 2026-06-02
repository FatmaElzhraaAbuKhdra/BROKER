import { Router } from "express";
import bcrypt from "bcryptjs";
import { getConnection, oracledb } from "../lib/oracle";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { testConnection } from "../lib/oracle";

const router = Router();

// POST /api/auth/login
router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT USER_ID, USERNAME, PASSWORD_HASH, FULL_NAME, EMAIL, ROLE, IS_ACTIVE
       FROM USERS WHERE USERNAME = :1`,
      [username],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    const rows = result.rows as Record<string, unknown>[];
    if (!rows || rows.length === 0) {
      res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      return;
    }

    const user = rows[0];
    if (!user["IS_ACTIVE"]) {
      res.status(401).json({ error: "الحساب غير مفعّل" });
      return;
    }

    const valid = await bcrypt.compare(password, user["PASSWORD_HASH"] as string);
    if (!valid) {
      res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      return;
    }

    const sess = req.session as Record<string, unknown>;
    sess["userId"] = user["USER_ID"];
    sess["username"] = user["USERNAME"];
    sess["fullName"] = user["FULL_NAME"];
    sess["role"] = user["ROLE"];

    res.json({
      userId: user["USER_ID"],
      username: user["USERNAME"],
      fullName: user["FULL_NAME"],
      email: user["EMAIL"],
      role: user["ROLE"],
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "خطأ في تسجيل الدخول" });
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// POST /api/auth/logout
router.post("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Logout failed" });
      return;
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully" });
  });
});

// GET /api/auth/me
router.get("/auth/me", requireAuth, (req, res) => {
  const sess = req.session as Record<string, unknown>;
  res.json({
    userId: sess["userId"],
    username: sess["username"],
    fullName: sess["fullName"],
    role: sess["role"],
  });
});

// POST /api/auth/register (admin only)
router.post("/auth/register", requireAdmin, async (req, res) => {
  const { username, password, fullName, email, role } = req.body;
  if (!username || !password || !fullName || !role) {
    res.status(400).json({ error: "Username, password, fullName, role are required" });
    return;
  }
  if (!["ADMIN", "ACCOUNTING"].includes(role)) {
    res.status(400).json({ error: "Role must be ADMIN or ACCOUNTING" });
    return;
  }

  let conn;
  try {
    conn = await getConnection();
    const hash = await bcrypt.hash(password, 12);
    const sess = req.session as Record<string, unknown>;
    await conn.execute(
      `INSERT INTO USERS (USERNAME, PASSWORD_HASH, FULL_NAME, EMAIL, ROLE, CREATED_BY)
       VALUES (:1, :2, :3, :4, :5, :6)`,
      [username, hash, fullName, email || null, role, sess["username"] || "ADMIN"],
      { autoCommit: true },
    );
    res.status(201).json({ message: "User created successfully" });
  } catch (err: unknown) {
    const e = err as { errorNum?: number };
    if (e.errorNum === 1) {
      res.status(409).json({ error: "Username already exists" });
    } else {
      req.log.error({ err }, "Register error");
      res.status(500).json({ error: "Failed to create user" });
    }
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
});

// GET /api/auth/connection-test
router.get("/auth/connection-test", async (_req, res) => {
  const result = await testConnection();
  res.json(result);
});

export default router;
