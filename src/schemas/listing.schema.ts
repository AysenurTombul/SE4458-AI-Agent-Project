import { z } from "zod";

export const createListingSchema = z.object({
  title: z.string().min(3),
  description: z.string().max(1000).optional(),
  capacity: z.number().int().min(1),
  country: z.string().min(2),
  city: z.string().min(2),
  price: z.number().positive(),
  amenities: z.array(z.string()).default([]).optional()
});

export type CreateListingInput = z.infer<typeof createListingSchema>;

export const queryListingSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  people: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
  size: z.coerce.number().optional(),
  minRating: z.coerce.number().min(0).max(5).optional()
});

export type QueryListingInput = z.infer<typeof queryListingSchema>;

export const reportListingSchema = z.object({
  country: z.string().optional(),
  city: z.string().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  page: z.coerce.number().optional(),
  size: z.coerce.number().optional()
});

export type ReportListingInput = z.infer<typeof reportListingSchema>;
