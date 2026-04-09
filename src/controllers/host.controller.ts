import { Request, Response } from "express";
import { createListingSchema } from "../schemas/listing.schema";
import { asyncHandler } from "../utils/asyncHandler";
import { createListing } from "../services/listing.service";
import { AppError } from "../utils/errors";

export const insertListing = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }
  const payload = createListingSchema.parse(req.body);
  const listing = await createListing(req.user.userId, payload);
  res.status(201).json(listing);
});
