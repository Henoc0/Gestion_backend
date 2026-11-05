import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { playerRepository } from "../player/player.repository.js";
import { GameController } from "./game.controller.js";
import { gameRepository } from "./game.repository.js";
import { GameService } from "./game.service.js";

const gameService = new GameService(gameRepository, playerRepository);
const gameController = new GameController(gameService);

const gameRouter = Router();

// Toutes les routes /game sont protégées par JWT
gameRouter.use(authMiddleware);

// Profil consolidé et gestion de l'apparence
gameRouter.get("/me", gameController.getMe);
gameRouter.patch("/me/appearance", gameController.updateAppearance);

// Missions et cycle de jeu
gameRouter.get("/missions", gameController.getMissions);
gameRouter.post("/missions/:id/start", gameController.startMission);
gameRouter.post("/runs/:id/complete", gameController.completeRun);

export { gameRouter };
export default gameRouter;

