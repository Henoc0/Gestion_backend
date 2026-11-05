import type { NextFunction, Request, Response } from "express";
import { BadRequestError, UnauthorizedError } from "../common/errors.js";
import type { GameService } from "./game.service.js";

function getAuthUserId(req: Request): string {
    const user = req.user;
    const userId = user?.id || user?.userId || user?._id || user?.sub;
    if (!userId) {
        throw new UnauthorizedError("Utilisateur non authentifié");
    }
    return String(userId);
}

export class GameController {
    constructor(private readonly gameService: GameService) {}

    getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = getAuthUserId(req);
            const data = await this.gameService.getGameMe(userId);

            res.status(200).json({
                success: true,
                data,
            });
        } catch (error) {
            next(error);
        }
    };

    updateAppearance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = getAuthUserId(req);
            const { characterId } = req.body;

            const data = await this.gameService.updateAppearance(userId, { characterId });

            res.status(200).json({
                success: true,
                message: "Apparence mise à jour",
                data,
            });
        } catch (error) {
            next(error);
        }
    };

    getMissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = getAuthUserId(req);
            const missions = await this.gameService.getMissions(userId);

            res.status(200).json({
                success: true,
                count: missions.length,
                data: missions,
            });
        } catch (error) {
            next(error);
        }
    };

    startMission = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = getAuthUserId(req);
            const missionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

            if (!missionId) {
                throw new BadRequestError("L'identifiant de mission est requis");
            }

            const result = await this.gameService.startMission(userId, missionId);

            res.status(result.isResume ? 200 : 201).json({
                success: true,
                message: result.isResume ? "Reprise de la tentative active" : "Nouvelle tentative lancée",
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    completeRun = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = getAuthUserId(req);
            const runId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

            if (!runId) {
                throw new BadRequestError("L'identifiant de tentative est requis");
            }

            const { durationSeconds, collectedItemIds, completedSequence, reachedExtractionZone } = req.body;

            const result = await this.gameService.completeRun(userId, runId, {
                durationSeconds: typeof durationSeconds === "number" ? durationSeconds : 0,
                collectedItemIds: Array.isArray(collectedItemIds) ? collectedItemIds : undefined,
                completedSequence: Array.isArray(completedSequence) ? completedSequence : undefined,
                reachedExtractionZone: typeof reachedExtractionZone === "string" ? reachedExtractionZone : undefined,
            });

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };
}
