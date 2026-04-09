import http from "k6/http";
import { check, group, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";
const LISTING_ID = __ENV.LISTING_ID;
const GUEST_TOKEN = __ENV.GUEST_TOKEN;

export const options = {
  scenarios: {
    normal: {
      executor: "constant-vus",
      vus: 20,
      duration: "30s"
    },
    peak: {
      executor: "constant-vus",
      vus: 50,
      startTime: "35s",
      duration: "30s"
    },
    stress: {
      executor: "constant-vus",
      vus: 100,
      startTime: "70s",
      duration: "30s"
    }
  }
};

const listingQuery = `${BASE_URL}/api/v1/guest/listings?city=Istanbul&country=Turkey&startDate=2025-05-01&endDate=2025-05-05&people=2`;

export default function () {
  group("query-listings", () => {
    const response = http.get(listingQuery);
    check(response, {
      "status is 200": (res) => res.status === 200,
      "has data": (res) => res.json("items").length >= 0
    });
  });

  if (LISTING_ID && GUEST_TOKEN) {
    group("book-stay", () => {
      const payload = JSON.stringify({
        listingId: LISTING_ID,
        startDate: "2025-06-01",
        endDate: "2025-06-03",
        names: ["Load Tester"]
      });

      const response = http.post(`${BASE_URL}/api/v1/guest/bookings`, payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GUEST_TOKEN}`
        }
      });

      check(response, {
        "booking success": (res) => res.status === 201 || res.status === 409
      });
    });
  }

  sleep(1);
}
