import { Router } from "express";
import { Role } from "@prisma/client";
import { insertListing } from "../controllers/host.controller";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.post("/listings", requireAuth, requireRole([Role.HOST, Role.ADMIN]), insertListing);

export default router;
