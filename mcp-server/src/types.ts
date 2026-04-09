// MCP Request/Response Types
export interface ListingFilters {
  startDate?: string;
  endDate?: string;
  country?: string;
  city?: string;
  people?: number;
  page?: number;
  size?: number;
  minRating?: number;
}

export interface QueryListingsResponse {
  items: Listing[];
  total: number;
  page: number;
  size: number;
}

export interface Listing {
  id: string;
  title: string;
  description?: string;
  capacity: number;
  country: string;
  city: string;
  price: number;
  amenities: string[];
  hostId: string;
  ratingAverage: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookingInput {
  listingId: string;
  startDate: string;
  endDate: string;
  occupantNames: string[];
}

export interface BookingResponse {
  id: string;
  listingId: string;
  guestId: string;
  startDate: string;
  endDate: string;
  occupantNames: string[];
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}

export interface ReviewInput {
  bookingId: string;
  listingId: string;
  rating: number;
  comment?: string;
}

export interface ReviewResponse {
  id: string;
  bookingId: string;
  guestId: string;
  listingId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface QueryReviewsResponse {
  items: ReviewResponse[];
  total: number;
}

export interface ToolInput {
  [key: string]: string | number | boolean | string[] | undefined;
}
