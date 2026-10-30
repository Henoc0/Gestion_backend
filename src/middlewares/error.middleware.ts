import type { NextFunction, Request, Response } from "express";
import { AppError } from "../common/errors.js";

/**
 * Forme des erreurs "techniques" (Express, MongoDB, Mongoose) qu'on veut reconnaître.
 * Error seul ne connaît pas ces propriétés, d'où cette interface.
 */
interface TechnicalError extends Error {
    type?: string;                              // erreurs de body-parser (express.json)
    code?: number | string;                     // erreurs MongoDB (11000 = doublon)
    keyPattern?: Record<string, unknown>;       // champ(s) en doublon
    path?: string;                              // champ en cause pour un CastError
    errors?: Record<string, { message: string }>; // détails d'un ValidationError Mongoose
}

const DB_UNAVAILABLE_ERRORS = new Set([
    "MongoServerSelectionError",
    "MongoNetworkError",
    "MongoNetworkTimeoutError",
]);

export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // 1. Erreurs métier que tu lèves toi-même
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: err.message
        });
        return;
    }

    const e = err as TechnicalError;

    // 2. JSON mal formé (levé par express.json())
    if (e.type === "entity.parse.failed") {
        res.status(400).json({ success: false, error: "Invalid JSON body" });
        return;
    }

    // 3. Corps de requête trop volumineux
    if (e.type === "entity.too.large") {
        res.status(413).json({ success: false, error: "Request body too large" });
        return;
    }

    // 4. Doublon sur un index unique (ex : deux inscriptions simultanées avec le même email)
    if (e.code === 11000) {
        const field = Object.keys(e.keyPattern ?? {})[0];
        const label = field ? field.charAt(0).toUpperCase() + field.slice(1) : undefined;
        res.status(400).json({
            success: false,
            error: label ? `${label} already in use` : "Duplicate value"
        });
        return;
    }

    // 5. Validation du schéma Mongoose (required, match, enum...)
    if (e.name === "ValidationError" && e.errors) {
        const messages = Object.values(e.errors).map((fieldError) => fieldError.message);
        res.status(400).json({ success: false, error: messages.join(", ") });
        return;
    }

    // 6. Identifiant mal formé (ex : un id qui n'est pas un ObjectId valide)
    if (e.name === "CastError") {
        res.status(400).json({ success: false, error: `Invalid ${e.path ?? "value"}` });
        return;
    }

    // 7. Base de données injoignable ou en timeout
    if (DB_UNAVAILABLE_ERRORS.has(e.name)) {
        console.error("Database unavailable:", err);
        res.status(503).json({ success: false, error: "Service temporarily unavailable" });
        return;
    }

    // 8. Tout le reste : vraie erreur serveur
    console.error("Unhandled Error:", err);
    res.status(500).json({
        success: false,
        error: "Internal Server Error"
    });
};