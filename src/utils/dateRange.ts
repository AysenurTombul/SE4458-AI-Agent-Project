export const rangesOverlap = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean => {
  return aStart <= bEnd && bStart <= aEnd;
};

export const normalizeDate = (value: string): Date => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date provided");
  }
  return date;
};
