import axios, { AxiosInstance } from 'axios';
import {
  ListingFilters,
  QueryListingsResponse,
  BookingInput,
  BookingResponse,
  QueryReviewsResponse,
  ReviewInput,
  ReviewResponse
} from './types.js';

export class APIClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor(baseURL: string = process.env.API_GATEWAY_URL || 'http://localhost:8080') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Query listings based on filters
   * Supports filtering by: city, country, date range, capacity, minimum rating
   */
  async queryListings(filters: ListingFilters): Promise<QueryListingsResponse> {
    try {
      const response = await this.client.get<QueryListingsResponse>(
        '/api/v1/guest/listings',
        { params: filters }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to query listings');
    }
  }

  /**
   * Fetch existing reviews for a listing
   * Requires: listingId (UUID)
   */
  async queryReviews(listingId: string): Promise<QueryReviewsResponse> {
    try {
      const response = await this.client.get<QueryReviewsResponse>(
        '/api/v1/guest/reviews',
        { params: { listingId } }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to query reviews');
    }
  }

  /**
   * Create a booking for a listing
   * Requires: listingId, startDate, endDate, occupantNames
   */
  async createBooking(bookingData: BookingInput): Promise<BookingResponse> {
    try {
      const response = await this.client.post<BookingResponse>(
        '/api/v1/guest/bookings',
        {
          listingId: bookingData.listingId,
          startDate: bookingData.startDate,
          endDate: bookingData.endDate,
          names: bookingData.occupantNames
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to create booking');
    }
  }

  /**
   * Create a review for a booking
   * Requires: bookingId, listingId, rating
   */
  async createReview(reviewData: ReviewInput): Promise<ReviewResponse> {
    try {
      const response = await this.client.post<ReviewResponse>(
        '/api/v1/guest/reviews',
        reviewData
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to create review');
    }
  }

  private handleError(error: unknown, message: string): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      throw new Error(`${message}: ${status} - ${JSON.stringify(data)}`);
    }
    throw new Error(`${message}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export default new APIClient();
