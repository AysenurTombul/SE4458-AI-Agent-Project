import { Router } from "express";
import authRoutes from "./auth.routes";
import hostRoutes from "./host.routes";
import guestRoutes from "./guest.routes";
import adminRoutes from "./admin.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/host", hostRoutes);
router.use("/guest", guestRoutes);
router.use("/admin", adminRoutes);

export default router;
