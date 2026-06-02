import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !(req.session as Record<string, unknown>)["userId"]) {
    res.status(401).json({ error: "Unauthorized - please login" });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session = req.session as Record<string, unknown>;
  if (!session["userId"]) {
    res.status(401).json({ error: "Unauthorized - please login" });
    return;
  }
  if (session["role"] !== "ADMIN") {
    res.status(403).json({ error: "Forbidden - Admin access required" });
    return;
  }
  next();
}

export function requireAccounting(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const session = req.session as Record<string, unknown>;
  if (!session["userId"]) {
    res.status(401).json({ error: "Unauthorized - please login" });
    return;
  }
  if (!["ADMIN", "ACCOUNTING"].includes(session["role"] as string)) {
    res.status(403).json({ error: "Forbidden - insufficient permissions" });
    return;
  }
  next();
}
