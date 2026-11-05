import { model, Schema, SchemaTypes } from "mongoose";

export type MissionRunStatus = "started" | "completed" | "abandoned";
export type MissionRewardStatus = "not_applicable" | "pending" | "granted" | "already_granted";

export interface MissionRunDocument {
    userId: Schema.Types.ObjectId | string;
    missionId: string;
    version: number;
    status: MissionRunStatus;
    startedAt: Date;
    completedAt?: Date;
    resultSummary?: Record<string, unknown>;
    rewardStatus: MissionRewardStatus;
    grantedXp?: number;
    grantedCosmetics?: string[];
    createdAt?: Date;
    updatedAt?: Date;
}

const missionRunSchema = new Schema<MissionRunDocument>(
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
        version: {
            type: Number,
            required: true,
            default: 1,
        },
        status: {
            type: String,
            enum: ["started", "completed", "abandoned"],
            default: "started",
            required: true,
            index: true,
        },
        startedAt: {
            type: Date,
            default: Date.now,
            required: true,
        },
        completedAt: {
            type: Date,
        },
        resultSummary: {
            type: SchemaTypes.Mixed,
        },
        rewardStatus: {
            type: String,
            enum: ["not_applicable", "pending", "granted", "already_granted"],
            default: "pending",
            required: true,
        },
        grantedXp: {
            type: Number,
            default: 0,
        },
        grantedCosmetics: {
            type: [String],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

// Index composé pour retrouver instantanément la tentative active d'un joueur
missionRunSchema.index({ userId: 1, status: 1 });
missionRunSchema.index({ userId: 1, missionId: 1 });

export const MissionRunModel = model<MissionRunDocument>("MissionRun", missionRunSchema);

