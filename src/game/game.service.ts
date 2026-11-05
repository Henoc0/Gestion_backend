import { BadRequestError, ForbiddenError, NotFoundError } from "../common/errors.js";
import { calculateLevelProgress } from "../player/level.utils.js";
import {
    CHARACTER_CATALOG,
    COSMETIC_CATALOG,
    getCharacterById,
    isCharacterUnlockedForPlayer,
    isValidCharacterId,
} from "../player/player.catalog.js";
import type { IPlayerRepository } from "../player/player.types.js";
import type {
    CompleteRunDto,
    CompleteRunResult,
    GameMeResponse,
    IGameRepository,
    MissionRun,
    PublicMissionInfo,
    UpdateAppearanceDto,
} from "./game.types.js";
import {
    MISSIONS_CATALOG,
    getMissionById,
    sanitizeMissionForClient,
} from "./missions.catalog.js";

export class GameService {
    constructor(
        private readonly gameRepository: IGameRepository,
        private readonly playerRepository: IPlayerRepository
    ) {}

    /**
     * Retourne la vue consolidée du joueur : profil, progression, apparences débloquées et résumé des missions.
     */
    async getGameMe(userId: string): Promise<GameMeResponse> {
        if (!userId || userId.trim() === "") {
            throw new BadRequestError("User ID is required");
        }

        const profile = await this.playerRepository.findOrCreateByUserId(userId);
        const progress = calculateLevelProgress(profile.totalXp);
        const activeCharacter = getCharacterById(profile.characterId);

        const availableCharacters = CHARACTER_CATALOG.filter((char) =>
            isCharacterUnlockedForPlayer(char.id, progress.currentLevel, profile.unlockedItems)
        );

        const availableCosmetics = COSMETIC_CATALOG.filter(
            (item) => progress.currentLevel >= item.requiredLevel || profile.unlockedItems.includes(item.id)
        );

        const rewardedMissionIds = await this.gameRepository.getRewardedMissionIds(userId);
        const totalCompletedRuns = await this.gameRepository.countCompletedRuns(userId);
        const activeRun = await this.gameRepository.findActiveRunByUserId(userId);

        return {
            profile,
            progress,
            activeCharacter,
            availableCharacters,
            availableCosmetics,
            missionsSummary: {
                totalCompletedRuns,
                rewardedMissionsCount: rewardedMissionIds.length,
                rewardedMissionIds,
                activeRun: activeRun ?? undefined,
            },
        };
    }

    /**
     * Met à jour l'apparence active du joueur en vérifiant ses droits d'accès.
     */
    async updateAppearance(userId: string, dto: UpdateAppearanceDto) {
        if (!userId || userId.trim() === "") {
            throw new BadRequestError("User ID is required");
        }

        if (dto.characterId) {
            const charId = dto.characterId.trim();
            if (!isValidCharacterId(charId)) {
                throw new BadRequestError(`Personnage '${charId}' inconnu`);
            }

            const profile = await this.playerRepository.findOrCreateByUserId(userId);
            const progress = calculateLevelProgress(profile.totalXp);

            const isUnlocked = isCharacterUnlockedForPlayer(
                charId,
                progress.currentLevel,
                profile.unlockedItems
            );

            if (!isUnlocked) {
                const char = getCharacterById(charId);
                throw new ForbiddenError(
                    `Ce personnage requiert le niveau ${char?.requiredLevel ?? 1} (niveau actuel : ${progress.currentLevel})`
                );
            }

            await this.playerRepository.updateCharacter(userId, charId);
        }

        return this.getGameMe(userId);
    }

    /**
     * Liste toutes les missions avec l'état contextualisé pour le joueur.
     */
    async getMissions(userId: string): Promise<PublicMissionInfo[]> {
        if (!userId || userId.trim() === "") {
            throw new BadRequestError("User ID is required");
        }

        const profile = await this.playerRepository.findOrCreateByUserId(userId);
        const progress = calculateLevelProgress(profile.totalXp);
        const rewardedIds = new Set(await this.gameRepository.getRewardedMissionIds(userId));
        const activeRun = await this.gameRepository.findActiveRunByUserId(userId);

        return MISSIONS_CATALOG.map((mission) => {
            let state: PublicMissionInfo["state"];

            if (activeRun && activeRun.missionId === mission.id) {
                state = "in_progress";
            } else if (rewardedIds.has(mission.id)) {
                state = "already_rewarded";
            } else if (progress.currentLevel < mission.minLevel) {
                state = "locked";
            } else {
                state = "available";
            }

            const publicData = sanitizeMissionForClient(mission);

            return {
                ...publicData,
                state,
                activeRunId: activeRun && activeRun.missionId === mission.id ? activeRun.id : undefined,
            };
        });
    }

    /**
     * Démarre une tentative ou reprend une tentative active sur la même mission.
     */
    async startMission(
        userId: string,
        missionId: string
    ): Promise<{ run: MissionRun; mission: PublicMissionInfo; isResume: boolean }> {
        if (!userId || userId.trim() === "") {
            throw new BadRequestError("User ID is required");
        }

        const mission = getMissionById(missionId);
        if (!mission) {
            throw new NotFoundError(`Mission '${missionId}' introuvable`);
        }

        const profile = await this.playerRepository.findOrCreateByUserId(userId);
        const progress = calculateLevelProgress(profile.totalXp);

        if (progress.currentLevel < mission.minLevel) {
            throw new ForbiddenError(
                `Niveau ${mission.minLevel} requis pour cette mission (niveau actuel : ${progress.currentLevel})`
            );
        }

        const activeRun = await this.gameRepository.findActiveRunByUserId(userId);

        // Règle de tentative active :
        // 1. Si le joueur a déjà une tentative commencée sur cette même mission, on la reprend (idempotence / reprise).
        if (activeRun && activeRun.missionId === mission.id) {
            const publicMission: PublicMissionInfo = {
                ...sanitizeMissionForClient(mission),
                state: "in_progress",
                activeRunId: activeRun.id,
            };
            return { run: activeRun, mission: publicMission, isResume: true };
        }

        // 2. Si le joueur commence une nouvelle mission alors qu'une autre était commencée, l'ancienne est clôturée comme abandonnée.
        if (activeRun) {
            await this.gameRepository.abandonOtherActiveRuns(userId);
        }

        const newRun = await this.gameRepository.createRun({
            userId,
            missionId: mission.id,
            version: mission.version,
        });

        const publicMission: PublicMissionInfo = {
            ...sanitizeMissionForClient(mission),
            state: "in_progress",
            activeRunId: newRun.id,
        };

        return { run: newRun, mission: publicMission, isResume: false };
    }

    /**
     * Clôture une tentative et attribue les récompenses avec garantie absolue d'unicité en base.
     */
    async completeRun(
        userId: string,
        runId: string,
        dto: CompleteRunDto
    ): Promise<CompleteRunResult> {
        if (!userId || userId.trim() === "") {
            throw new BadRequestError("User ID is required");
        }

        if (!runId || runId.trim() === "") {
            throw new BadRequestError("Run ID is required");
        }

        const run = await this.gameRepository.findRunById(runId.trim());
        if (!run) {
            throw new NotFoundError("Tentative de mission introuvable");
        }

        // 1. Vérification de propriété
        if (run.userId !== userId) {
            throw new ForbiddenError("Vous n'êtes pas autorisé à modifier cette tentative");
        }

        // 2. Gestion de la réentrance / idempotence séquentielle
        if (run.status === "completed") {
            const profile = await this.playerRepository.findOrCreateByUserId(userId);
            const progress = calculateLevelProgress(profile.totalXp);
            return {
                runId: run.id,
                missionId: run.missionId,
                status: "completed",
                rewardStatus: run.rewardStatus,
                xpGranted: 0,
                cosmeticsGranted: [],
                progress,
                message: "Cette tentative a déjà été validée précédemment",
            };
        }

        if (run.status === "abandoned") {
            throw new BadRequestError("Cette tentative a été abandonnée et ne peut plus être validée");
        }

        const mission = getMissionById(run.missionId);
        if (!mission) {
            throw new NotFoundError(`Mission '${run.missionId}' non référencée dans le catalogue`);
        }

        // 3. Validation adaptée au jeu solo (cohérence des durées et des objectifs)
        const startedTime = new Date(run.startedAt).getTime();
        const serverDurationSeconds = (Date.now() - startedTime) / 1000;

        if (serverDurationSeconds < mission.minDurationSeconds) {
            throw new BadRequestError(
                `Durée de tentative invraisemblable (${Math.round(serverDurationSeconds)}s sur ${mission.minDurationSeconds}s requises)`
            );
        }

        if (mission.validationSecrets?.requiredItemIds) {
            const collected = new Set(dto.collectedItemIds ?? []);
            for (const requiredItem of mission.validationSecrets.requiredItemIds) {
                if (!collected.has(requiredItem)) {
                    throw new BadRequestError(`Objectif incomplet : élément requis '${requiredItem}' manquant`);
                }
            }
        }

        if (mission.validationSecrets?.expectedSequence) {
            const sequence = dto.completedSequence ?? [];
            const expected = mission.validationSecrets.expectedSequence;
            if (
                sequence.length !== expected.length ||
                sequence.some((val, idx) => val !== expected[idx])
            ) {
                throw new BadRequestError("La séquence d'activation soumise est incorrecte");
            }
        }

        if (mission.validationSecrets?.requiredExtractionZone) {
            if (dto.reachedExtractionZone !== mission.validationSecrets.requiredExtractionZone) {
                throw new BadRequestError("Zone d'extraction non atteinte");
            }
        }

        // 4. Détermination et attribution des récompenses avec verrous d'unicité en base
        const alreadyRewarded = await this.gameRepository.hasUserReceivedReward(userId, mission.id);

        let finalRewardStatus: "granted" | "already_granted" = "already_granted";
        let xpToGrant = 0;
        let cosmeticsToGrant: string[] = [];

        if (!alreadyRewarded) {
            // Tentative d'insertion atomique du reçu de récompense via contrainte unique { userId: 1, missionId: 1 }
            const wasInserted = await this.gameRepository.recordRewardAtomically({
                userId,
                missionId: mission.id,
                runId: run.id,
                xpGranted: mission.rewardXp,
                cosmeticsGranted: mission.rewardCosmetics,
            });

            if (wasInserted) {
                finalRewardStatus = "granted";
                xpToGrant = mission.rewardXp;
                cosmeticsToGrant = mission.rewardCosmetics;

                // Incrémentation atomique du profil
                await this.playerRepository.addXp(userId, xpToGrant);
                for (const item of cosmeticsToGrant) {
                    await this.playerRepository.unlockItem(userId, item);
                }
            }
        }

        // 5. Clôture atomique de la tentative
        const completedRun = await this.gameRepository.completeRunAtomically(run.id, userId, {
            resultSummary: {
                clientDuration: dto.durationSeconds,
                serverDuration: Math.round(serverDurationSeconds),
                collectedItemsCount: dto.collectedItemIds?.length ?? 0,
            },
            rewardStatus: finalRewardStatus,
            grantedXp: xpToGrant,
            grantedCosmetics: cosmeticsToGrant,
            completedAt: new Date(),
        });

        // Sécurité double-clôture simultanée
        if (!completedRun) {
            const profile = await this.playerRepository.findOrCreateByUserId(userId);
            const progress = calculateLevelProgress(profile.totalXp);
            return {
                runId: run.id,
                missionId: run.missionId,
                status: "completed",
                rewardStatus: "already_granted",
                xpGranted: 0,
                cosmeticsGranted: [],
                progress,
                message: "Tentative clôturée en parallèle par une autre requête",
            };
        }

        const updatedProfile = await this.playerRepository.findOrCreateByUserId(userId);
        const progress = calculateLevelProgress(updatedProfile.totalXp);

        return {
            runId: completedRun.id,
            missionId: completedRun.missionId,
            status: "completed",
            rewardStatus: finalRewardStatus,
            xpGranted: xpToGrant,
            cosmeticsGranted: cosmeticsToGrant,
            progress,
            message:
                finalRewardStatus === "granted"
                    ? `Mission réussie ! +${xpToGrant} XP attribués.`
                    : "Mission réussie ! (Récompense déjà perçue précédemment)",
        };
    }
}

