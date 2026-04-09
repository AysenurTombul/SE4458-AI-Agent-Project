import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { verifyToken } from "../utils/jwt";
import { AppError } from "../utils/errors";

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError("Authentication required", 401);
  }

  const token = header.split(" ")[1];
  const payload = verifyToken(token);
  req.user = { userId: payload.userId, role: payload.role };
  next();
};

export const requireRole = (roles: Role[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  if (!roles.includes(req.user.role)) {
    throw new AppError("Not authorized", 403);
  }

  next();
};
