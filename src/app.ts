// app.ts
import express, { type Express } from "express";
import { employeeRouter } from "./employee/employee.routes.js";
import { authRouter } from "./auth/auth.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { NotFoundError } from "./common/errors.js";
import { config } from "./config/env.js";

import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

/**
 * Factory qui construit et configure une instance Express.
 * Ne lance PAS le serveur (pas de listen) et ne se connecte PAS à la DB —
 * ça permet de l'importer dans les tests sans effets de bord.
 */
export function createApp(): Express {
    const app = express();

    // 1. Sécurité des en-têtes HTTP et CORS pour autoriser le frontend
    app.use(helmet());
    app.use(
        cors({
            origin: process.env.CORS_ORIGIN
                ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
                : [
                    "http://localhost:5173", // Vite (React, Vue, Svelte)
                    "http://localhost:3000", // Next.js / Create React App
                    "http://localhost:8080", // Nginx / Vue CLI
                ],
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization"],
        })
    );

    // 2. Body Parser avec limitation de taille pour contrer les DoS
    app.use(express.json({ limit: "10kb" }));

    // 3. Rate Limiter sur l'authentification contre les attaques par force brute (désactivé en test)
    if (config.nodeEnv !== "testing") {
        const authLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 25, // 25 requêtes max par IP sur la fenêtre
            message: {
                success: false,
                error: "Trop de tentatives d'authentification. Veuillez réessayer plus tard.",
            },
            standardHeaders: true,
            legacyHeaders: false,
        });
        app.use("/auth", authLimiter);
    }

    // 4. Routes
    app.use("/employees", employeeRouter);
    app.use("/auth", authRouter);

    // Route racine / health check
    app.get("/", (_req, res) => {
        res.status(200).json({
            success: true,
            message: "API Node.js 3-tiers fonctionnelle",
            environment: config.nodeEnv,
        });
    });

    // Middleware 404 pour les routes inconnues
    app.use((req, _res, next) => {
        next(new NotFoundError(`Route ${req.method} ${req.originalUrl} introuvable`));
    });

    // Middleware global de gestion des erreurs (doit être après les routes)
    app.use(errorHandler);

    return app;
}