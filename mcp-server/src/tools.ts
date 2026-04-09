import apiClient from './api-client.js';
import { ListingFilters, ToolInput } from './types.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateUuid(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw new Error(`Invalid ${fieldName}: must be a valid UUID`);
  }
  return value;
}

function normalizeBookingNames(input: ToolInput): string[] {
  const namesValue = input.occupantNames ?? input.names;

  if (Array.isArray(namesValue)) {
    const cleaned = namesValue.filter((name): name is string => typeof name === 'string' && name.trim().length > 0);
    if (cleaned.length === 0) {
      throw new Error('occupantNames must contain at least one non-empty name');
    }
    return cleaned;
  }

  if (typeof namesValue === 'string' && namesValue.trim().length > 0) {
    return [namesValue.trim()];
  }

  throw new Error('occupantNames (or names) is required and must be a string or string[]');
}

function normalizeDateInput(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const isoLikeMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoLikeMatch) {
    const parsed = new Date(`${isoLikeMatch[1]}-${isoLikeMatch[2]}-${isoLikeMatch[3]}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return `${isoLikeMatch[1]}-${isoLikeMatch[2]}-${isoLikeMatch[3]}`;
    }
    return undefined;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString().slice(0, 10);
}

function sanitizeListingFilters(input: ToolInput): ListingFilters {
  const startDate = normalizeDateInput(input.startDate);
  const endDate = normalizeDateInput(input.endDate);

  return {
    city: input.city as string | undefined,
    country: input.country as string | undefined,
    people: input.people as number | undefined,
    minRating: input.minRating as number | undefined,
    page: input.page as number | undefined,
    size: input.size as number | undefined,
    ...(startDate && endDate ? { startDate, endDate } : {})
  };
}

function normalizeRequiredBookingDate(value: unknown, fieldName: 'startDate' | 'endDate'): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} is required and must be a valid date (YYYY-MM-DD)`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required and must be a valid date (YYYY-MM-DD)`);
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    throw new Error(`${fieldName} must be a valid calendar date (YYYY-MM-DD)`);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid date (YYYY-MM-DD)`);
  }

  return parsed.toISOString().slice(0, 10);
}

/**
 * MCP Tools definitions for the Listing System
 * These tools can be called by the Agent through MCP protocol
 */

export const tools = [
  {
    name: 'query_listings',
    description:
      'Search for available listings based on location, dates, capacity, and other filters. ' +
      'Returns a list of accommodations that match the criteria.',
    inputSchema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'City name to search in (e.g., "Paris", "Istanbul")'
        },
        country: {
          type: 'string',
          description: 'Country name to search in (e.g., "France", "Turkey")'
        },
        people: {
          type: 'number',
          description: 'Number of people the listing should accommodate'
        },
        startDate: {
          type: 'string',
          description: 'Check-in date (ISO 8601 format: YYYY-MM-DD)'
        },
        endDate: {
          type: 'string',
          description: 'Check-out date (ISO 8601 format: YYYY-MM-DD)'
        },
        minRating: {
          type: 'number',
          description: 'Minimum rating (0-5) for listings'
        },
        page: {
          type: 'number',
          description: 'Page number for pagination (default: 1)'
        },
        size: {
          type: 'number',
          description: 'Number of results per page (default: 10)'
        }
      },
      required: []
    }
  },
  {
    name: 'create_booking',
    description:
      'Book a listing for specified dates. Returns booking confirmation details. ' +
      'Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        listingId: {
          type: 'string',
          description: 'ID of the listing to book'
        },
        startDate: {
          type: 'string',
          description: 'Check-in date (ISO 8601 format: YYYY-MM-DD)'
        },
        endDate: {
          type: 'string',
          description: 'Check-out date (ISO 8601 format: YYYY-MM-DD)'
        },
        occupantNames: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of occupant names'
        }
      },
      required: ['listingId', 'startDate', 'endDate', 'occupantNames']
    }
  },
  {
    name: 'query_reviews',
    description:
      'Fetch/Get existing reviews for a listing. ' +
      'Use this tool to retrieve reviews, not to create a new review.',
    inputSchema: {
      type: 'object',
      properties: {
        listingId: {
          type: 'string',
          description: 'ID of the listing to fetch reviews for'
        }
      },
      required: ['listingId']
    }
  },
  {
    name: 'create_review',
    description:
      'Submit a review for a completed booking. Returns review confirmation details. ' +
      'Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        bookingId: {
          type: 'string',
          description: 'ID of the booking to review'
        },
        listingId: {
          type: 'string',
          description: 'ID of the listing being reviewed'
        },
        rating: {
          type: 'number',
          description: 'Rating from 1 to 5'
        },
        comment: {
          type: 'string',
          description: 'Optional review comment'
        }
      },
      required: ['bookingId', 'listingId', 'rating']
    }
  }
];

/**
 * Execute a tool with given input
 * @param toolName - Name of the tool to execute
 * @param input - Input parameters for the tool
 * @param token - Optional JWT token for authenticated endpoints
 * @returns Result of tool execution
 */
export async function executeTool(
  toolName: string,
  input: ToolInput,
  token?: string
): Promise<unknown> {
  switch (toolName) {
    case 'query_listings': {
      const filters = sanitizeListingFilters(input);
      return await apiClient.queryListings(filters);
    }

    case 'create_booking': {
      const listingId = validateUuid(input.listingId, 'listingId');
      const occupantNames = normalizeBookingNames(input);
      const startDate = normalizeRequiredBookingDate(input.startDate, 'startDate');
      const endDate = normalizeRequiredBookingDate(input.endDate, 'endDate');

      if (startDate > endDate) {
        throw new Error('startDate must be before endDate');
      }

      return await apiClient.createBooking(
        {
          listingId,
          startDate,
          endDate,
          occupantNames
        }
      );
    }

    case 'query_reviews':
    case 'get_reviews': {
      const listingId = validateUuid(input.listingId, 'listingId');
      return await apiClient.queryReviews(listingId);
    }

    case 'create_review': {
      return await apiClient.createReview(
        {
          bookingId: input.bookingId as string,
          listingId: input.listingId as string,
          rating: input.rating as number,
          comment: input.comment as string | undefined
        }
      );
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
