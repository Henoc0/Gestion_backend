import type { PlayerLevelProgress } from "../player/level.utils.js";
import type { CharacterItem, CosmeticItem } from "../player/player.catalog.js";
import type { PlayerProfile } from "../player/player.types.js";
import type { MissionObjective } from "./missions.catalog.js";
import type { MissionRewardStatus, MissionRunStatus } from "./mission-run.model.js";

export interface MissionRun {
    id: string;
    userId: string;
    missionId: string;
    version: number;
    status: MissionRunStatus;
    startedAt: Date;
    completedAt?: Date | undefined;
    resultSummary?: Record<string, unknown> | undefined;
    rewardStatus: MissionRewardStatus;
    grantedXp?: number | undefined;
    grantedCosmetics?: string[] | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
}

export type PlayerMissionState = "locked" | "available" | "in_progress" | "already_rewarded";

export interface PublicMissionInfo {
    id: string;
    version: number;
    title: string;
    description: string;
    environmentId: string;
    minLevel: number;
    rewardXp: number;
    rewardCosmetics: string[];
    objectives: MissionObjective[];
    state: PlayerMissionState;
    activeRunId?: string | undefined;
}

export interface CompleteRunDto {
    durationSeconds: number;
    collectedItemIds?: string[] | undefined;
    completedSequence?: string[] | undefined;
    reachedExtractionZone?: string | undefined;
    customData?: Record<string, unknown> | undefined;
}

export interface CompleteRunResult {
    runId: string;
    missionId: string;
    status: MissionRunStatus;
    rewardStatus: MissionRewardStatus;
    xpGranted: number;
    cosmeticsGranted: string[];
    progress: PlayerLevelProgress;
    message: string;
}

export interface GameMeResponse {
    profile: PlayerProfile;
    progress: PlayerLevelProgress;
    activeCharacter?: CharacterItem | undefined;
    availableCharacters: readonly CharacterItem[];
    availableCosmetics: readonly CosmeticItem[];
    missionsSummary: {
        totalCompletedRuns: number;
        rewardedMissionsCount: number;
        rewardedMissionIds: string[];
        activeRun?: MissionRun | undefined;
    };
}

export interface UpdateAppearanceDto {
    characterId?: string | undefined;
}

export interface IGameRepository {
    findActiveRunByUserId(userId: string): Promise<MissionRun | null>;
    findRunById(runId: string): Promise<MissionRun | null>;
    createRun(data: { userId: string; missionId: string; version: number }): Promise<MissionRun>;
    abandonRun(runId: string): Promise<boolean>;
    abandonOtherActiveRuns(userId: string, exceptRunId?: string): Promise<number>;
    completeRunAtomically(
        runId: string,
        userId: string,
        data: {
            resultSummary: Record<string, unknown>;
            rewardStatus: MissionRewardStatus;
            grantedXp: number;
            grantedCosmetics: string[];
            completedAt: Date;
        }
    ): Promise<MissionRun | null>;
    hasUserReceivedReward(userId: string, missionId: string): Promise<boolean>;
    recordRewardAtomically(data: {
        userId: string;
        missionId: string;
        runId: string;
        xpGranted: number;
        cosmeticsGranted: string[];
    }): Promise<boolean>;
    getRewardedMissionIds(userId: string): Promise<string[]>;
    countCompletedRuns(userId: string): Promise<number>;
}

