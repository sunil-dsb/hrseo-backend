import { getSession } from "@/controllers/user.controller";
import { checkAuthentication } from "@/middlewares/checkAuthentication";
import { Router } from "express";

const router: Router = Router();

router.get("/get-user-session", checkAuthentication, getSession);

export default router;
