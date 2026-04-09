import prisma from "../lib/prisma";
import { CreateListingInput, QueryListingInput, ReportListingInput } from "../schemas/listing.schema";
import { ListingCsvRow } from "../utils/csv";
import { AppError } from "../utils/errors";
import { buildPagination } from "../utils/pagination";
import { normalizeDate } from "../utils/dateRange";

type ListingEntity = Awaited<ReturnType<typeof prisma.listing.create>>;

const normalizePrice = (value: ListingEntity["price"]): number => Number(value);

const mapListingResponse = (listing: ListingEntity) => ({
  ...listing,
  price: normalizePrice(listing.price)
});

const buildLocationFilter = (value?: string) =>
  value
    ? {
        equals: value
      }
    : undefined;

const buildAvailabilityFilter = (startDate?: string, endDate?: string) => {
  if (!startDate || !endDate) {
    return undefined;
  }
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  if (start > end) {
    throw new AppError("startDate must be before endDate", 400);
  }

  return {
    startDate: {
      lte: end
    },
    endDate: {
      gte: start
    }
  };
};

export const createListing = (hostId: string, input: CreateListingInput) => {
  return prisma.listing
    .create({
      data: {
        ...input,
        amenities: input.amenities ?? [],
        hostId
      }
    })
    .then(mapListingResponse);
};

export const bulkCreateListings = async (hostId: string, rows: ListingCsvRow[]) => {
  const validRows = rows.filter((row) => row.capacity > 0 && row.country && row.city && row.price > 0);
  if (!validRows.length) {
    throw new AppError("No valid rows found in CSV", 400);
  }

  await prisma.$transaction(
    validRows.map((row) =>
      prisma.listing.create({
        data: {
          title: row.title ?? `${row.city} stay for ${row.capacity}`,
          description: row.description,
          capacity: row.capacity,
          country: row.country,
          city: row.city,
          price: row.price,
          hostId,
          amenities: []
        }
      })
    )
  );

  return { inserted: validRows.length };
};

export const queryListings = async (filters: QueryListingInput) => {
  const pagination = buildPagination({ page: filters.page, size: filters.size, maxSize: 10 });
  const availabilityFilter = buildAvailabilityFilter(filters.startDate, filters.endDate);

  const where = {
    capacity: filters.people ? { gte: filters.people } : undefined,
    country: buildLocationFilter(filters.country),
    city: buildLocationFilter(filters.city),
    ratingAverage: filters.minRating ? { gte: filters.minRating } : undefined,
    bookings: availabilityFilter
      ? {
          none: availabilityFilter
        }
      : undefined
  };

  const [items, total] = (await prisma.$transaction([
    prisma.listing.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { ratingAverage: "desc" }
    }),
    prisma.listing.count({ where })
  ])) as [ListingEntity[], number];

  return {
    items: items.map(mapListingResponse),
    meta: {
      total,
      page: pagination.page,
      size: pagination.size
    }
  };
};

export const reportListings = async (filters: ReportListingInput) => {
  const pagination = buildPagination({ page: filters.page, size: filters.size, maxSize: 10 });
  const where = {
    country: buildLocationFilter(filters.country),
    city: buildLocationFilter(filters.city),
    ratingAverage: filters.minRating ? { gte: filters.minRating } : undefined
  };

  type ListingWithCounts = ListingEntity & {
    _count: {
      reviews: number;
      bookings: number;
    };
  };

  const [items, total] = (await prisma.$transaction([
    prisma.listing.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      include: {
        _count: {
          select: { reviews: true, bookings: true }
        }
      },
      orderBy: { ratingAverage: "desc" }
    }),
    prisma.listing.count({ where })
  ])) as [ListingWithCounts[], number];

  return {
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      country: item.country,
      city: item.city,
      capacity: item.capacity,
      price: Number(item.price),
      ratingAverage: item.ratingAverage,
      ratingCount: item.ratingCount,
      totalBookings: item._count.bookings
    })),
    meta: {
      total,
      page: pagination.page,
      size: pagination.size
    }
  };
};
