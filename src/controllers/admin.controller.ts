import { Request, Response } from "express";
import { reportListingSchema } from "../schemas/listing.schema";
import { asyncHandler } from "../utils/asyncHandler";
import { reportListings, bulkCreateListings } from "../services/listing.service";
import { AppError } from "../utils/errors";
import { parseListingCsv } from "../utils/csv";

export const getListingsReport = asyncHandler(async (req: Request, res: Response) => {
  const filters = reportListingSchema.parse(req.query);
  const report = await reportListings(filters);
  res.json(report);
});

export const adminInsertListingsByFile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }
  if (!req.file) {
    throw new AppError("CSV file is required", 400);
  }

  const rows = parseListingCsv(req.file.buffer);
  const result = await bulkCreateListings(req.user.userId, rows);
  res.status(201).json(result);
});
