import { model, Schema, SchemaTypes } from "mongoose";
import { DEFAULT_CHARACTER_ID, DEFAULT_UNLOCKED_ITEMS } from "./player.catalog.js";

export interface PlayerProfileDocument {
    userId: Schema.Types.ObjectId | string;
    characterId: string;
    totalXp: number;
    unlockedItems: string[];
    createdAt?: Date;
    updatedAt?: Date;
}

const playerProfileSchema = new Schema<PlayerProfileDocument>(
    {
        userId: {
            type: SchemaTypes.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },
        characterId: {
            type: String,
            required: true,
            default: DEFAULT_CHARACTER_ID,
            trim: true,
        },
        totalXp: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },
        unlockedItems: {
            type: [String],
            default: DEFAULT_UNLOCKED_ITEMS,
        },
    },
    {
        timestamps: true,
    }
);

export const PlayerProfileModel = model<PlayerProfileDocument>(
    "PlayerProfile",
    playerProfileSchema
);

