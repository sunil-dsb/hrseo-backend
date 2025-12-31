import { Router } from "express";
import authRouter from "./auth.route";
import userRouter from "./user.route";
import planRouter from "./plan.route";
import adminRouter from "./admin.route";

const router: Router = Router();

router.use("/auth", authRouter);
router.use("/user", userRouter);
router.use("/plan", planRouter);
router.use("/admin", adminRouter);

export default router;
