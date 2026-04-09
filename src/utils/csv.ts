import { parse } from "csv-parse/sync";

export type ListingCsvRow = {
  title?: string;
  description?: string;
  capacity: number;
  country: string;
  city: string;
  price: number;
};

export const parseListingCsv = (buffer: Buffer): ListingCsvRow[] => {
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((record: Record<string, string>) => ({
    title: record.title || record.Title || record["Listing Title"],
    description: record.description || record.Description,
    capacity: Number(record.capacity ?? record["No of People"] ?? 0),
    country: record.country || record.Country,
    city: record.city || record.City,
    price: Number(record.price ?? record.Price ?? 0)
  }));
};
