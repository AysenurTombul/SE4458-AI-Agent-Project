import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors";

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message, details: err.details });
  }

  if (err instanceof Error) {
    return res.status(500).json({ message: err.message });
  }

  return res.status(500).json({ message: "Unknown error" });
};
