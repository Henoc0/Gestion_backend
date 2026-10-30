import type { NextFunction, Request, Response } from "express";

//Fonction pour gérer les erreurs de manière globale pour être appelé dans chaque fonction après
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await fn(req, res, next);
        } catch (error) {
            next(error);
        }
    };
};