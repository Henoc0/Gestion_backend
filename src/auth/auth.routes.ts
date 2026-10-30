import { Router } from "express";
import { userRepository } from "../user/user.repository.js";
import { AuthService } from "./auth.services.js";
import { AuthController } from "./auth.controller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";

// Instanciation des couches (Pattern 3-tiers avec Injection de Dépendance)
const authService = new AuthService(userRepository);
const authController = new AuthController(authService);

const authRouter = Router();

// Routes d'authentification
authRouter.post("/register", authController.register);
authRouter.post("/login", authController.login);
authRouter.get("/me", authMiddleware, authController.me);
authRouter.post("/logout", authController.logout);

export { authRouter };
export default authRouter;
