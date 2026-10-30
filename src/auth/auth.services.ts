import { BadRequestError, NotFoundError, UnauthorizedError } from "../common/errors.js";
import { comparePassword, generateToken, hashPassword } from "../common/utils.js";
import type { User } from "../user/user.model.js";
import type { IUserRepository, LoginDto, RegisterDto } from "../user/user.types.js";
import { config } from "../config/env.js";

/**
 * Service d'authentification.
 * Contient la logique métier (inscription, connexion...).
 */
export class AuthService {
    constructor(private readonly userRepository: IUserRepository) {}

    async register(dto: RegisterDto): Promise<User> {
        if (!dto.name || dto.name.trim() === "") {
            throw new BadRequestError("Name is required and cannot be empty");
        }

        if (!dto.email || dto.email.trim() === "") {
            throw new BadRequestError("Email is required");
        }

        if (!dto.password || dto.password.trim() === "") {
            throw new BadRequestError("Password is required");
        }

        const existing = await this.userRepository.findByEmail(dto.email);
        if (existing) {
            throw new BadRequestError("Email already in use");
        }

        const hashedPassword = await hashPassword(dto.password);

        return this.userRepository.create({
            name: dto.name.trim(),
            email: dto.email.trim().toLowerCase(),
            password: hashedPassword,
        });
    }

    async getByEmail(email: string): Promise<User | null> {
        return this.userRepository.findByEmail(email);
    }

    async getProfile(userId: string): Promise<User> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new NotFoundError("Utilisateur introuvable");
        }
        return user;
    }

    async getByEmailWithPassword(email: string): Promise<(User & { password?: string }) | null> {
        return this.userRepository.findByEmailWithPassword(email);
    }

    async checkPassword(plainText: string, hashedPassword: string): Promise<boolean> {
        return comparePassword(plainText, hashedPassword);
    }

    async login(dto: LoginDto): Promise<{ user: User; token: string }> {
        if (!dto.email || dto.email.trim() === "") {
            throw new BadRequestError("Email is required");
        }

        if (!dto.password || dto.password.trim() === "") {
            throw new BadRequestError("Password is required");
        }

        const userWithPassword = await this.userRepository.findByEmailWithPassword(dto.email.trim().toLowerCase());
        if (!userWithPassword || !userWithPassword.password) {
            throw new UnauthorizedError("Identifiants invalides");
        }

        const isMatch = await comparePassword(dto.password, userWithPassword.password);
        if (!isMatch) {
            throw new UnauthorizedError("Identifiants invalides");
        }

        // Ne pas renvoyer le hash du mot de passe dans le résultat
        const { password: _, ...user } = userWithPassword;
        const token = await this.generateAuthToken(user);

        return {
            user,
            token,
        };
    }

    async generateAuthToken(user: User): Promise<string> {
        return generateToken({ id: user.id, email: user.email, name: user.name }, config.jwt.secret, config.jwt.expiresIn);
    }
}
