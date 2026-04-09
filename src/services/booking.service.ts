import prisma from "../lib/prisma";
import { BookStayInput } from "../schemas/booking.schema";
import { AppError } from "../utils/errors";
import { normalizeDate } from "../utils/dateRange";

const ensureAvailability = async (listingId: string, start: Date, end: Date) => {
  const overlapping = await prisma.booking.findFirst({
    where: {
      listingId,
      status: { in: ["CONFIRMED", "PENDING"] },
      startDate: { lte: end },
      endDate: { gte: start }
    }
  });

  if (overlapping) {
    throw new AppError("Listing is not available for the selected dates", 409);
  }
};

export const bookStay = async (guestId: string, input: BookStayInput) => {
  const start = normalizeDate(input.startDate);
  const end = normalizeDate(input.endDate);
  if (start >= end) {
    throw new AppError("endDate must be after startDate", 400);
  }

  const listing = await prisma.listing.findUnique({ where: { id: input.listingId } });
  if (!listing) {
    throw new AppError("Listing not found", 404);
  }

  if (input.names.length > listing.capacity) {
    throw new AppError("Listing capacity exceeded", 400);
  }

  await ensureAvailability(listing.id, start, end);

  const booking = await prisma.booking.create({
    data: {
      listingId: listing.id,
      guestId,
      startDate: start,
      endDate: end,
      occupantNames: input.names,
      status: "CONFIRMED"
    },
    include: {
      listing: true
    }
  });

  return {
    ...booking,
    listing: booking.listing
      ? {
          ...booking.listing,
          price: Number(booking.listing.price)
        }
      : undefined
  };
};
