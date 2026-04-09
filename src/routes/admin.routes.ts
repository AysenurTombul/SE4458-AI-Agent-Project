import { Router } from "express";
import multer from "multer";
import { getListingsReport, adminInsertListingsByFile } from "../controllers/admin.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { Role } from "@prisma/client";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get(
  "/reports/listings",
  requireAuth,
  requireRole([Role.ADMIN]),
  getListingsReport
);

router.post(
  "/listings/upload",
  requireAuth,
  requireRole([Role.ADMIN]),
  upload.single("file"),
  adminInsertListingsByFile
);

export default router;
