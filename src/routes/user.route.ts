import { getUserData } from "@/controllers/user.controller";
import { Router } from "express";

const router: Router = Router();

router.get("/get-user-data", getUserData);

export default router;
