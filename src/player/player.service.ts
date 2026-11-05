import { BadRequestError, ForbiddenError, NotFoundError } from "../common/errors.js";
import { calculateLevelProgress } from "./level.utils.js";
import {
    CHARACTER_CATALOG,
    COSMETIC_CATALOG,
    DEFAULT_CHARACTER_ID,
    getCharacterById,
    isCharacterUnlockedForPlayer,
    isValidCharacterId,
} from "./player.catalog.js";
import type {
    GameCatalogResponse,
    IPlayerRepository,
    PlayerProfileWithProgress,
} from "./player.types.js";

export class PlayerService {
    constructor(private readonly playerRepository: IPlayerRepository) {}

    /**
     * Récupère le profil du joueur ou l'initialise s'il n'existe pas encore.
     * Idempotent et sans risque de doublon.
     */
    async getProfile(userId: string): Promise<PlayerProfileWithProgress> {
        if (!userId || userId.trim() === "") {
            throw new BadRequestError("User ID is required");
        }

        const profile = await this.playerRepository.findOrCreateByUserId(userId.trim());
        const progress = calculateLevelProgress(profile.totalXp);
        const activeCharacter = getCharacterById(profile.characterId);

        return {
            ...profile,
            progress,
            activeCharacter,
        };
    }

    /**
     * Sélectionne le personnage actif pour le joueur en vérifiant les conditions d'accès.
     */
    async selectCharacter(userId: string, characterId: string): Promise<PlayerProfileWithProgress> {
        if (!userId || userId.trim() === "") {
            throw new BadRequestError("User ID is required");
        }

        if (!characterId || characterId.trim() === "") {
            throw new BadRequestError("Character ID is required");
        }

        const trimmedCharacterId = characterId.trim();

        if (!isValidCharacterId(trimmedCharacterId)) {
            throw new BadRequestError(`Le personnage '${trimmedCharacterId}' n'existe pas dans le catalogue`);
        }

        const currentProfile = await this.playerRepository.findOrCreateByUserId(userId.trim());
        const progress = calculateLevelProgress(currentProfile.totalXp);

        const isUnlocked = isCharacterUnlockedForPlayer(
            trimmedCharacterId,
            progress.currentLevel,
            currentProfile.unlockedItems
        );

        if (!isUnlocked) {
            const targetChar = getCharacterById(trimmedCharacterId);
            const reqLevel = targetChar?.requiredLevel ?? 1;
            throw new ForbiddenError(
                `Ce personnage n'est pas encore débloqué. Niveau ${reqLevel} requis (niveau actuel : ${progress.currentLevel})`
            );
        }

        const updated = await this.playerRepository.updateCharacter(userId.trim(), trimmedCharacterId);
        if (!updated) {
            throw new NotFoundError("Impossible de mettre à jour le profil du joueur");
        }

        const updatedProgress = calculateLevelProgress(updated.totalXp);
        const activeCharacter = getCharacterById(updated.characterId);

        return {
            ...updated,
            progress: updatedProgress,
            activeCharacter,
        };
    }

    /**
     * Fournit le catalogue complet des personnages et cosmétiques du jeu.
     */
    getCatalog(): GameCatalogResponse {
        return {
            characters: CHARACTER_CATALOG,
            cosmetics: COSMETIC_CATALOG,
            defaultCharacterId: DEFAULT_CHARACTER_ID,
        };
    }
}

