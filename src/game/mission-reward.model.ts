import { model, Schema, SchemaTypes } from "mongoose";

export interface MissionRewardDocument {
    userId: Schema.Types.ObjectId | string;
    missionId: string;
    runId: Schema.Types.ObjectId | string;
    xpGranted: number;
    cosmeticsGranted: string[];
    rewardedAt: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

const missionRewardSchema = new Schema<MissionRewardDocument>(
    {
        userId: {
            type: SchemaTypes.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        missionId: {
            type: String,
            required: true,
            trim: true,
        },
        runId: {
            type: SchemaTypes.ObjectId,
            ref: "MissionRun",
            required: true,
        },
        xpGranted: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },
        cosmeticsGranted: {
            type: [String],
            default: [],
        },
        rewardedAt: {
            type: Date,
            default: Date.now,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Contrainte UNIQUE ABSOLUE : empêche strictement l'attribution de récompenses multiples
// même lors de requêtes concurrentes, de tentatives séparées ou de mise à jour de version.
missionRewardSchema.index({ userId: 1, missionId: 1 }, { unique: true });

export const MissionRewardModel = model<MissionRewardDocument>(
    "MissionReward",
    missionRewardSchema
);

