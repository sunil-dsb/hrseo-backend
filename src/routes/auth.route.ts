import {
  login,
  logout,
  register,
  renewToken,
} from "@/controllers/auth.controller";
import { checkAuthenticationRefresh } from "@/middlewares/checkAuthentication";
import { Router } from "express";

const router: Router = Router();

router.post("/login", login);
router.post("/register", register);
router.get("/logout", checkAuthenticationRefresh, logout);
router.get("/renew-token", checkAuthenticationRefresh, renewToken);

export default router;
