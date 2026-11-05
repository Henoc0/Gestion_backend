import type { PlayerLevelProgress } from "./level.utils.js";
import type { CharacterItem, CosmeticItem } from "./player.catalog.js";

export interface PlayerProfile {
    id: string;
    userId: string;
    characterId: string;
    totalXp: number;
    unlockedItems: string[];
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
}

export interface PlayerProfileWithProgress extends PlayerProfile {
    progress: PlayerLevelProgress;
    activeCharacter?: CharacterItem | undefined;
}

export interface SelectCharacterDto {
    characterId: string;
}

export interface GameCatalogResponse {
    characters: readonly CharacterItem[];
    cosmetics: readonly CosmeticItem[];
    defaultCharacterId: string;
}

export interface IPlayerRepository {
    findByUserId(userId: string): Promise<PlayerProfile | null>;
    findOrCreateByUserId(userId: string): Promise<PlayerProfile>;
    updateCharacter(userId: string, characterId: string): Promise<PlayerProfile | null>;
    addXp(userId: string, xpDelta: number): Promise<PlayerProfile | null>;
    unlockItem(userId: string, itemId: string): Promise<PlayerProfile | null>;
}
