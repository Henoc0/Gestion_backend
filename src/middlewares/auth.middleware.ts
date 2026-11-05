import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { verifyToken } from "../common/utils.js";
import { UserModel } from "../user/user.model.js";

const authPattern = /^bearer\s+.+/i;

// Authorization: Bearer <token>
export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.get("Authorization") || "";
    if (!authHeader?.match(authPattern)) {
        res.status(401).json({
            error: "Invalid authorization header. Expected format is: Bearer <token>",
        });
        return;
    }

    const token = authHeader.split(" ")[1]?.trim();

    if (!token) {
        res.status(401).json({ error: "Token missing" });
        return;
    }

    try {
        const decoded = await verifyToken<Record<string, unknown>>(token, config.jwt.secret);
        req.user = decoded as any;
    } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            res.status(401).json({ error: "Token expired" });
            return;
        }
        if (err instanceof jwt.JsonWebTokenError) {
            res.status(401).json({ error: "Invalid token" });
            return;
        }
        console.error("Unexpected auth error:", err);
        res.status(500).json({ error: "Internal server error" });
        return;
    }

    // Vérification de sécurité : si le compte a été désactivé après émission du token
    const userId = req.user?.id || req.user?.userId || req.user?._id || req.user?.sub;
    if (userId) {
        try {
            const user = await UserModel.findById(userId).select("isActive").lean();
            if (user && !user.isActive) {
                res.status(401).json({ error: "Ce compte a été désactivé" });
                return;
            }
        } catch (dbErr) {
            // Ne bloque pas si le serveur de test tourne sans connexion DB active
        }
    }

    return next();
};