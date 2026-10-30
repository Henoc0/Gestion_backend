import type { NextFunction, Request, Response } from "express";
import { AuthService } from "./auth.services.js";
import { createValidator } from "@rblmdst/scheval";
import { EmailPattern, PasswordPattern } from "../common/const.js";
import { asyncHandler } from "../middlewares/utils.mid.js";
import { UnauthorizedError } from "../common/errors.js";

export class AuthController {
    constructor(private readonly authService: AuthService) { }

    register = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // try {
        const { name, email, password } = req.body;
        const payload = { name, email, password };
        const ValidatorConfig = {
            name: {
                type: ["string", "The user name must be a string"],
                required: ["The user name is required"],
            },
            email: {
                type: ["string", "The user email must be a string"],
                required: ["The user email is required"],
                min: [5, "L'email doit contenir au moins 5 caractères"],
                max: [254, "L'email ne doit pas dépasser 254 caractères"],
                match: [EmailPattern, "Email invalide"],
            },
            password: {
                type: ["string", "The user password must be a string"],
                required: ["The user password is required"],
                min: [5, "Le mot de passe doit contenir au moins 5 caractères"],
                max: [20, "Le mot de passe ne doit pas dépasser 20 caractères"],
                match: PasswordPattern,
            },
        };
        const validator = createValidator(ValidatorConfig);
        const validationError = validator.validate(payload);

        const hasErrors = Array.isArray(validationError)
            ? validationError.length > 0
            : validationError && typeof validationError === "object"
                ? Object.keys(validationError).length > 0
                : Boolean(validationError);

        if (hasErrors) {
            console.error("Validation errors:", validationError);
            res.status(400).json({
                success: false,
                error: "Données de formulaire invalides",
                errors: validationError,
            });
            return;
        }

        const user = await this.authService.register({ name, email, password });

        res.status(201).json({
            success: true,
            message: "User registered",
            data: user,
        });
        // } catch (error) {
        //     console.error("Registration error in controller:", error);
        //     next(error);
        // }
    });

    login = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            const { email, password } = req.body;
            const payload = { email, password };
            const ValidatorConfig = {
                email: {
                    type: ["string", "The user email must be a string"],
                    required: ["The user email is required"],
                    min: [5, "L'email doit contenir au moins 5 caractères"],
                    max: [254, "L'email ne doit pas dépasser 254 caractères"],
                    match: [EmailPattern, "Email invalide"],
                },
                password: {
                    type: ["string", "The user password must be a string"],
                    required: ["The user password is required"],
                    min: [5, "Le mot de passe doit contenir au moins 5 caractères"],
                    max: [20, "Le mot de passe ne doit pas dépasser 20 caractères"],
                    match: PasswordPattern,
                },
            };
            const validator = createValidator(ValidatorConfig);
            const validationError = validator.validate(payload);

            const hasErrors = Array.isArray(validationError)
                ? validationError.length > 0
                : validationError && typeof validationError === "object"
                    ? Object.keys(validationError).length > 0
                    : Boolean(validationError);

            if (hasErrors) {
                console.error("Validation errors:", validationError);
                res.status(400).json({
                    success: false,
                    error: "Données de formulaire invalides",
                    errors: validationError,
                });
                return;
            }

            const result = await this.authService.login({ email, password });
            res.status(200).json({
                success: true,
                token: result.token,
                data: result.user,
            });
        });

    me = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const user = req.user;
        const userId = user?.id || user?.userId || user?._id || user?.sub;
        if (!userId) {
            throw new UnauthorizedError("Utilisateur non authentifié");
        }

        const profile = await this.authService.getProfile(String(userId));
        res.status(200).json({
            success: true,
            data: profile,
        });
    });

    logout = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
        res.status(200).json({
            success: true,
            message: "Déconnexion réussie",
        });
    });
}

