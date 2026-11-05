import { MissionRewardModel } from "./mission-reward.model.js";
import { MissionRunModel, type MissionRewardStatus } from "./mission-run.model.js";
import type { IGameRepository, MissionRun } from "./game.types.js";

function toMissionRun(doc: {
    _id: unknown;
    userId: unknown;
    missionId: string;
    version: number;
    status: "started" | "completed" | "abandoned";
    startedAt: Date;
    completedAt?: Date;
    resultSummary?: Record<string, unknown>;
    rewardStatus: MissionRewardStatus;
    grantedXp?: number;
    grantedCosmetics?: string[];
    createdAt?: Date;
    updatedAt?: Date;
}): MissionRun {
    const run: MissionRun = {
        id: String(doc._id),
        userId: String(doc.userId),
        missionId: doc.missionId,
        version: doc.version,
        status: doc.status,
        startedAt: doc.startedAt,
        rewardStatus: doc.rewardStatus,
    };

    if (doc.completedAt) run.completedAt = doc.completedAt;
    if (doc.resultSummary) run.resultSummary = doc.resultSummary;
    if (doc.grantedXp !== undefined) run.grantedXp = doc.grantedXp;
    if (doc.grantedCosmetics) run.grantedCosmetics = doc.grantedCosmetics;
    if (doc.createdAt) run.createdAt = doc.createdAt;
    if (doc.updatedAt) run.updatedAt = doc.updatedAt;

    return run;
}

export const gameRepository: IGameRepository = {
    async findActiveRunByUserId(userId: string): Promise<MissionRun | null> {
        const doc = await MissionRunModel.findOne({
            userId,
            status: "started",
        })
            .sort({ startedAt: -1 })
            .lean();

        return doc ? toMissionRun(doc) : null;
    },

    async findRunById(runId: string): Promise<MissionRun | null> {
        const doc = await MissionRunModel.findById(runId).lean();
        return doc ? toMissionRun(doc) : null;
    },

    async createRun(data: { userId: string; missionId: string; version: number }): Promise<MissionRun> {
        const doc = await MissionRunModel.create({
            userId: data.userId,
            missionId: data.missionId,
            version: data.version,
            status: "started",
            startedAt: new Date(),
            rewardStatus: "pending",
        });

        return toMissionRun(doc.toObject());
    },

    async abandonRun(runId: string): Promise<boolean> {
        const res = await MissionRunModel.findByIdAndUpdate(runId, {
            status: "abandoned",
            completedAt: new Date(),
        });
        return res !== null;
    },

    async abandonOtherActiveRuns(userId: string, exceptRunId?: string): Promise<number> {
        const query: Record<string, unknown> = {
            userId,
            status: "started",
        };
        if (exceptRunId) {
            query._id = { $ne: exceptRunId };
        }
        const res = await MissionRunModel.updateMany(query, {
            status: "abandoned",
            completedAt: new Date(),
        });
        return res.modifiedCount;
    },

    /**
     * Clôture atomique de la tentative.
     * La condition { _id: runId, userId, status: "started" } garantit qu'une tentative
     * ne peut JAMAIS être clôturée deux fois en simultané ou séquentiellement.
     */
    async completeRunAtomically(
        runId: string,
        userId: string,
        data: {
            resultSummary: Record<string, unknown>;
            rewardStatus: MissionRewardStatus;
            grantedXp: number;
            grantedCosmetics: string[];
            completedAt: Date;
        }
    ): Promise<MissionRun | null> {
        const doc = await MissionRunModel.findOneAndUpdate(
            {
                _id: runId,
                userId,
                status: "started",
            },
            {
                $set: {
                    status: "completed",
                    resultSummary: data.resultSummary,
                    rewardStatus: data.rewardStatus,
                    grantedXp: data.grantedXp,
                    grantedCosmetics: data.grantedCosmetics,
                    completedAt: data.completedAt,
                },
            },
            { new: true }
        ).lean();

        return doc ? toMissionRun(doc) : null;
    },

    async hasUserReceivedReward(userId: string, missionId: string): Promise<boolean> {
        const exists = await MissionRewardModel.exists({ userId, missionId });
        return exists !== null;
    },

    /**
     * Enregistre la récompense de façon atomique.
     * Grâce à l'index unique composé { userId: 1, missionId: 1 }, toute tentative concurrente
     * échoue immédiatement avec une erreur code 11000 et renvoie false.
     */
    async recordRewardAtomically(data: {
        userId: string;
        missionId: string;
        runId: string;
        xpGranted: number;
        cosmeticsGranted: string[];
    }): Promise<boolean> {
        try {
            await MissionRewardModel.create({
                userId: data.userId,
                missionId: data.missionId,
                runId: data.runId,
                xpGranted: data.xpGranted,
                cosmeticsGranted: data.cosmeticsGranted,
                rewardedAt: new Date(),
            });
            return true;
        } catch (error: any) {
            if (error?.code === 11000) {
                // Déjà récompensé par une requête concurrente ou précédente
                return false;
            }
            throw error;
        }
    },

    async getRewardedMissionIds(userId: string): Promise<string[]> {
        const rewards = await MissionRewardModel.find({ userId })
            .select("missionId")
            .lean();
        return rewards.map((r) => r.missionId);
    },

    async countCompletedRuns(userId: string): Promise<number> {
        return MissionRunModel.countDocuments({ userId, status: "completed" });
    },
};

export default gameRepository;

