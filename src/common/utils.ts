import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

/**
 * Hache un mot de passe de manière asynchrone en utilisant le nombre de salt rounds configuré.
 */
export const hashPassword = async (password: string): Promise<string> => {
    return bcrypt.hash(password, config.bcrypt.saltRounds);
};

/**
 * Compare un mot de passe en clair avec son hash bcrypt de manière asynchrone.
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
    return bcrypt.compare(password, hash);
};

export interface GenerateTokenOptions {
    payload: Record<string, any>;
    secret?: string;
    expiresIn?: string | number;
}

/**
 * Génère un Token JWT de manière asynchrone.
 * Utilise la clé secrète et la durée d'expiration du module de configuration si non fournies.
 */
export const generateToken = async (
    payloadOrOptions: Record<string, any> | GenerateTokenOptions,
    secret?: string,
    expiresIn?: string | number
): Promise<string> => {
    let payload: Record<string, any>;
    let secretKey: string;
    let expiration: string | number;

    if (payloadOrOptions && typeof payloadOrOptions === "object" && "payload" in payloadOrOptions && "secret" in payloadOrOptions) {
        payload = payloadOrOptions.payload;
        secretKey = payloadOrOptions.secret || config.jwt.secret;
        expiration = payloadOrOptions.expiresIn ?? config.jwt.expiresIn;
    } else {
        payload = payloadOrOptions;
        secretKey = secret || config.jwt.secret;
        expiration = expiresIn || config.jwt.expiresIn;
    }

    return new Promise((resolve, reject) => {
        jwt.sign(payload, secretKey, { expiresIn: expiration as any }, (err, token) => {
            if (err || !token) {
                return reject(err || new Error("Échec de la génération du token"));
            }
            resolve(token);
        });
    });
};

/**
 * Vérifie un Token JWT de manière asynchrone.
 */
export const verifyToken = async <T = Record<string, any>>(
    token: string,
    secret?: string
): Promise<T> => {
    const secretKey = secret || config.jwt.secret;
    return new Promise((resolve, reject) => {
        jwt.verify(token, secretKey, (err, decoded) => {
            if (err || !decoded) {
                return reject(err || new Error("Token invalide ou expiré"));
            }
            resolve(decoded as T);
        });
    });
};
