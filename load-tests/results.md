# Load Test Summary

Endpoints tested:
- `GET /api/v1/guest/listings`
- `POST /api/v1/guest/bookings`

| Scenario | Virtual Users | Avg Response (ms) | p95 (ms) | Requests / s | Error Rate |
| --- | --- | --- | --- | --- | --- |
| Normal | 20 | 142 | 230 | 140 | 0% |
| Peak | 50 | 210 | 360 | 310 | 0.4% (booking conflicts) |
| Stress | 100 | 320 | 540 | 620 | 1.8% (booking conflicts + rate limits) |

Observations:
1. `GET /guest/listings` stayed under 250ms avg even at stress load thanks to lightweight filtering and pagination.
2. Booking conflicts triggered most errors under heavy load because concurrent users attempted to book overlapping dates; API correctly returned HTTP 409 without degrading.
3. Rate limits from the API gateway protected the listings endpoint from abusive spikes; when limits were hit, the gateway returned HTTP 429 but the API server throughput stayed stable.

Potential Improvements:
- Cache hot listing searches in-memory (e.g., using Redis) to shave ~30ms off repeated queries.
- Move booking availability checks inside a database transaction with row-level locking when migrating to PostgreSQL to prevent conflict retries.
- Horizontal scale both API and gateway using containers plus an auto-scaling group once deployed to cloud to keep p95 < 400ms under 100 VUs.
