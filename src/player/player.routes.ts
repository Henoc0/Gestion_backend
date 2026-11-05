import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { PlayerController } from "./player.controller.js";
import { playerRepository } from "./player.repository.js";
import { PlayerService } from "./player.service.js";

const playerService = new PlayerService(playerRepository);
const playerController = new PlayerController(playerService);

const playerRouter = Router();
 
// Catalogue accessible publiquement ou authentifié
playerRouter.get("/catalog", playerController.getCatalog);

// Routes privées pour le joueur
playerRouter.get("/profile", authMiddleware, playerController.getProfile);
playerRouter.put("/character", authMiddleware, playerController.updateCharacter);

export { playerRouter };
export default playerRouter;

