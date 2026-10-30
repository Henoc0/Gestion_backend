import { model, Schema } from "mongoose";
import { EmailPattern } from "../common/const.js";

/**
 * Interface représentant l'Utilisateur retourné par l'API.
 * Le mot de passe est optionnel pour ne pas l'exposer par défaut.
 */
export interface User {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    password?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * Document interne Mongoose stocké en MongoDB.
 */
export interface UserDocument {
    name: string;
    email: string;
    password?: string;
    isActive: boolean;
}

const userSchema = new Schema<UserDocument>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            match: [EmailPattern, "Email invalide"],
        },
        password: {
            type: String,
            required: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

export const UserModel = model<UserDocument>("User", userSchema);
