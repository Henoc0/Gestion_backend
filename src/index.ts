// index.ts
import type { Server } from "node:http";
import { createApp } from "./app.js";
import { connectDB } from "./config/database.js";
import { config } from "./config/env.js";
import mongoose from "mongoose";

let server: Server | undefined;

async function bootstrap(): Promise<Server> {
    const app = createApp();
    const PORT = config.port;
    const uri = config.db.uri;

    try {
        await connectDB(uri);
    } catch (error) {
        console.error("❌ Échec de la connexion à la base de données:", error);
        process.exit(1);
    }

    const serverInstance = app.listen(PORT, () => {
        console.log(`🚀 Serveur démarré en mode [${config.nodeEnv}] sur le port ${PORT} -> http://localhost:${PORT}`);
    });
    return serverInstance;
}

bootstrap().then((serverInstance) => {
    server = serverInstance;
});

// Capturer les erreurs venant de sources extérieures à l'application
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
    gracefulShutdown(server, 1);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    gracefulShutdown(server, 1);
});

// Signal pour couper le serveur au Ctrl + C
process.on("SIGINT", () => {
    console.log("SIGINT: process terminated");
    gracefulShutdown(server);
});

// Signal envoyé par des gestionnaires de service (Docker, Kubernetes, systemd)
process.on("SIGTERM", () => {
    console.log("SIGTERM: process terminated");
    gracefulShutdown(server);
});

function gracefulShutdown(serverInstance?: Server, exitcode = 0) {
    console.log("Graceful shutdown... closing connections...");

    const closeDatabase = async () => {
        try {
            await mongoose.connection.close(false);
            console.log("Database connection closed cleanly.");
            process.exit(exitcode);
        } catch (dbErr) {
            console.error("Error closing database:", dbErr);
            process.exit(1);
        }
    };

    if (serverInstance && serverInstance.listening) {
        serverInstance.close(() => {
            console.log("HTTP server closed.");
            void closeDatabase();
        });
    } else {
        void closeDatabase();
    }

    // Sécurité : forcer la fermeture après 3s si des connexions restent ouvertes
    setTimeout(() => {
        console.warn("Forcing database connection close after timeout.");
        void mongoose.connection.close(true).then(() => {
            process.exit(1);
        });
    }, 3000).unref();
}