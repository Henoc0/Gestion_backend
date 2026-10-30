import type { User } from "./user.model.js";

export type { User };

/**
 * Données requises pour la création / l'inscription d'un utilisateur.
 */
export interface RegisterDto {
    name: string;
    email: string;
    password: string;
}

/**
 * Données requises pour la connexion d'un utilisateur.
 */
export interface LoginDto {
    email: string;
    password: string;
}

/**
 * Contrat du Repository Utilisateur.
 */
export interface IUserRepository {
    findByEmail(email: string): Promise<User | null>;
    findByEmailWithPassword(email: string): Promise<(User & { password?: string }) | null>;
    findById(id: string): Promise<User | null>;
    create(data: RegisterDto): Promise<User>;
}
