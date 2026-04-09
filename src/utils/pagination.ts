export type PaginationInput = {
  page?: number;
  size?: number;
  maxSize?: number;
};

export const buildPagination = ({ page = 1, size = 10, maxSize = 10 }: PaginationInput) => {
  const safePage = page < 1 ? 1 : page;
  const safeSize = size > maxSize ? maxSize : size;
  const skip = (safePage - 1) * safeSize;
  return { skip, take: safeSize, page: safePage, size: safeSize };
};
