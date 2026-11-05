import { PlayerProfileModel } from "./player-profile.model.js";
import { DEFAULT_CHARACTER_ID, DEFAULT_UNLOCKED_ITEMS } from "./player.catalog.js";
import type { IPlayerRepository, PlayerProfile } from "./player.types.js";

function toPlayerProfile(doc: {
    _id: unknown;
    userId: unknown;
    characterId: string;
    totalXp: number;
    unlockedItems?: string[];
    createdAt?: Date;
    updatedAt?: Date;
}): PlayerProfile {
    const profile: PlayerProfile = {
        id: String(doc._id),
        userId: String(doc.userId),
        characterId: doc.characterId,
        totalXp: doc.totalXp ?? 0,
        unlockedItems: Array.isArray(doc.unlockedItems) ? [...doc.unlockedItems] : [...DEFAULT_UNLOCKED_ITEMS],
    };

    if (doc.createdAt) {
        profile.createdAt = doc.createdAt;
    }
    if (doc.updatedAt) {
        profile.updatedAt = doc.updatedAt;
    }

    return profile;
}

export const playerRepository: IPlayerRepository = {
    async findByUserId(userId: string): Promise<PlayerProfile | null> {
        const doc = await PlayerProfileModel.findOne({ userId }).lean();
        return doc ? toPlayerProfile(doc) : null;
    },

    /**
     * Recherche ou crée de manière idempotente le profil joueur.
     * Utilise un upsert atomique MongoDB ($setOnInsert) pour éviter toute collision
     * en cas de requêtes simultanées ou pour les comptes utilisateurs préexistants.
     */
    async findOrCreateByUserId(userId: string): Promise<PlayerProfile> {
        const doc = await PlayerProfileModel.findOneAndUpdate(
            { userId },
            {
                $setOnInsert: {
                    userId,
                    characterId: DEFAULT_CHARACTER_ID,
                    totalXp: 0,
                    unlockedItems: DEFAULT_UNLOCKED_ITEMS,
                },
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
            }
        ).lean();

        return toPlayerProfile(doc);
    },

    async updateCharacter(userId: string, characterId: string): Promise<PlayerProfile | null> {
        const doc = await PlayerProfileModel.findOneAndUpdate(
            { userId },
            { $set: { characterId } },
            { new: true }
        ).lean();

        return doc ? toPlayerProfile(doc) : null;
    },

    async addXp(userId: string, xpDelta: number): Promise<PlayerProfile | null> {
        const safeDelta = Math.max(0, Math.floor(xpDelta));
        const doc = await PlayerProfileModel.findOneAndUpdate(
            { userId },
            { $inc: { totalXp: safeDelta } },
            { new: true }
        ).lean();

        return doc ? toPlayerProfile(doc) : null;
    },

    async unlockItem(userId: string, itemId: string): Promise<PlayerProfile | null> {
        const doc = await PlayerProfileModel.findOneAndUpdate(
            { userId },
            { $addToSet: { unlockedItems: itemId } },
            { new: true }
        ).lean();

        return doc ? toPlayerProfile(doc) : null;
    },
};

export default playerRepository;

