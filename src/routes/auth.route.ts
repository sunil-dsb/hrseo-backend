import { login, register, renewToken } from "@/controllers/auth.controller";
import { checkAuthenticationRefresh } from "@/middlewares/checkAuthentication";
import { Router } from "express";

const router: Router = Router();

router.get("/login", login);
router.get("/register", register);
router.get("/renew-token", checkAuthenticationRefresh, renewToken);

export default router;
