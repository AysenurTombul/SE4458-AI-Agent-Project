import { Request, Response } from "express";
import { Role } from "@prisma/client";
import { queryListingSchema } from "../schemas/listing.schema";
import { bookStaySchema } from "../schemas/booking.schema";
import { reviewSchema } from "../schemas/review.schema";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { queryListings } from "../services/listing.service";
import { bookStay } from "../services/booking.service";
import { getReviewsByListing, reviewStay } from "../services/review.service";
import { AppError } from "../utils/errors";
import prisma from "../lib/prisma";

export const getListings = asyncHandler(async (req: Request, res: Response) => {
  const filters = queryListingSchema.parse(req.query);
  const result = await queryListings(filters);
  res.json(result);
});

export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  let guestId = req.user?.userId;

  if (!guestId) {
    const demoGuest = await prisma.user.findFirst({
      where: { role: Role.GUEST },
      select: { id: true }
    });

    if (!demoGuest) {
      throw new AppError("No guest user available for demo booking", 500);
    }

    guestId = demoGuest.id;
  }

  const payload = bookStaySchema.parse(req.body);
  const booking = await bookStay(guestId, payload);
  res.status(201).json(booking);
});

export const createReview = asyncHandler(async (req: Request, res: Response) => {
  let guestId = req.user?.userId;

  if (!guestId) {
    const demoGuest = await prisma.user.findFirst({
      where: { role: Role.GUEST },
      select: { id: true }
    });

    if (!demoGuest) {
      throw new AppError("No guest user available for demo review", 500);
    }

    guestId = demoGuest.id;
  }

  const payload = reviewSchema.parse(req.body);
  const review = await reviewStay(guestId, payload);
  res.status(201).json(review);
});

export const getReviews = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ listingId: z.string().uuid() });
  const { listingId } = schema.parse(req.query);
  const reviews = await getReviewsByListing(listingId);
  res.json({ items: reviews, total: reviews.length });
});
