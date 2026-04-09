import { Router } from "express";
import { Role } from "@prisma/client";
import { getListings, createBooking, createReview, getReviews } from "../controllers/guest.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { dailyLimit } from "../middleware/dailyLimit";

const router = Router();

router.get("/listings", dailyLimit(), getListings);
router.get("/reviews", getReviews);
router.post("/bookings", createBooking);
router.post("/reviews", createReview);

export default router;
