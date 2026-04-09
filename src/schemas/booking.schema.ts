import { z } from "zod";

export const bookStaySchema = z.object({
  listingId: z.string().uuid(),
  startDate: z.string(),
  endDate: z.string(),
  names: z.array(z.string().min(1)).min(1)
});

export type BookStayInput = z.infer<typeof bookStaySchema>;
