import { getAllUsers } from "@/controllers/admin.controller";
import { checkAuthentication } from "@/middlewares/checkAuthentication";
import { checkAuthorization } from "@/middlewares/checkAuthorization";
import { Router } from "express";

const router: Router = Router();

router.get(
  "/user/get-all-users",
  checkAuthentication,
  checkAuthorization({ module: "User_management", action: "canReadList" }),
  getAllUsers
);

export default router;
