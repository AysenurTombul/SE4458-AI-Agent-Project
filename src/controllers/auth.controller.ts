import { Request, Response } from "express";
import { registerSchema, loginSchema } from "../schemas/auth.schema";
import { registerUser, loginUser } from "../services/auth.service";
import { asyncHandler } from "../utils/asyncHandler";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const payload = registerSchema.parse(req.body);
  const result = await registerUser(payload);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const payload = loginSchema.parse(req.body);
  const result = await loginUser(payload);
  res.json(result);
});
