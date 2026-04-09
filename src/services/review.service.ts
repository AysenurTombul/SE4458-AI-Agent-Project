import prisma from "../lib/prisma";
import { ReviewInput } from "../schemas/review.schema";
import { AppError } from "../utils/errors";

export const getReviewsByListing = async (listingId: string) => {
  return prisma.review.findMany({
    where: { listingId },
    include: {
      guest: {
        select: {
          id: true,
          fullName: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
};

export const reviewStay = async (guestId: string, input: ReviewInput) => {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: { listing: true }
  });

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  if (booking.guestId !== guestId) {
    throw new AppError("You can only review stays you booked", 403);
  }

  if (booking.endDate > new Date()) {
    throw new AppError("Reviews are allowed after the stay is completed", 400);
  }

  const existing = await prisma.review.findUnique({ where: { bookingId: booking.id } });
  if (existing) {
    throw new AppError("A review already exists for this stay", 400);
  }

  const review = await prisma.review.create({
    data: {
      bookingId: booking.id,
      guestId,
      listingId: booking.listingId,
      rating: input.rating,
      comment: input.comment
    }
  });

  const stats = await prisma.review.aggregate({
    where: { listingId: booking.listingId },
    _avg: { rating: true },
    _count: { rating: true }
  });

  await prisma.listing.update({
    where: { id: booking.listingId },
    data: {
      ratingAverage: stats._avg.rating ?? 0,
      ratingCount: stats._count.rating
    }
  });

  return review;
};
