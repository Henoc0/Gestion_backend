import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../common/errors.js";
import type { PlayerService } from "./player.service.js";

function getAuthUserId(req: Request): string {
    const user = req.user;
    const userId = user?.id || user?.userId || user?._id || user?.sub;
    if (!userId) {
        throw new UnauthorizedError("Utilisateur non authentifié");
    }
    return String(userId);
}

export class PlayerController {
    constructor(private readonly playerService: PlayerService) {}

    getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = getAuthUserId(req);
            const profile = await this.playerService.getProfile(userId);

            res.status(200).json({
                success: true,
                data: profile,
            });
        } catch (error) {
            next(error);
        }
    };

    updateCharacter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = getAuthUserId(req);
            const { characterId } = req.body;

            const updatedProfile = await this.playerService.selectCharacter(userId, characterId);

            res.status(200).json({
                success: true,
                message: "Personnage actif mis à jour",
                data: updatedProfile,
            });
        } catch (error) {
            next(error);
        }
    };

    getCatalog = (_req: Request, res: Response): void => {
        const catalog = this.playerService.getCatalog();
        res.status(200).json({
            success: true,
            data: catalog,
        });
    };
}

