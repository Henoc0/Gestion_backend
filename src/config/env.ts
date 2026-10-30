import dotenv from "dotenv";

dotenv.config();

/**
 * Module de configuration centralisé.
 * Valide et exporte les variables d'environnement de manière fortement typée.
 */
export const config = {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || "development",
    db: {
        name: process.env.DB_NAME || "",
        username: process.env.DB_USERNAME || "",
        password: process.env.DB_PASSWORD || "",
        uri: process.env.MONGO_DB_URI || "",
    },
    jwt: {
        secret: process.env.SECRET_JWT_TOKEN || "",
        expiresIn: process.env.JWT_EXPIRES_IN || "20m",
    },
    bcrypt: {
        saltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
    },
} as const;

// Validation au démarrage pour garantir que l'application ne tourne pas avec des clés critiques manquantes
if (!config.jwt.secret) {
    throw new Error("❌ CRITICAL: SECRET_JWT_TOKEN is not defined in environment variables");
}

