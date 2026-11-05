import { beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert";
import { GameService } from "./game.service.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../common/errors.js";
import type { IGameRepository, MissionRun } from "./game.types.js";
import type { IPlayerRepository, PlayerProfile } from "../player/player.types.js";

describe("SkillQuest - GameService", () => {
    let gameRepository: IGameRepository;
    let playerRepository: IPlayerRepository;
    let service: GameService;

    const mockProfileLevel1: PlayerProfile = {
        id: "profile-1",
        userId: "player-alpha",
        characterId: "cadet-scout",
        totalXp: 0, // Niveau 1
        unlockedItems: ["badge-pioneer"],
    };

    const mockProfileLevel2: PlayerProfile = {
        id: "profile-1",
        userId: "player-alpha",
        characterId: "cadet-scout",
        totalXp: 150, // Niveau 2 (seuil 100)
        unlockedItems: ["badge-pioneer"],
    };

    const createMockRun = (overrides?: Partial<MissionRun>): MissionRun => ({
        id: "run-101",
        userId: "player-alpha",
        missionId: "mission-1-beacons",
        version: 1,
        status: "started",
        startedAt: new Date(Date.now() - 10000), // démarré il y a 10s
        rewardStatus: "pending",
        ...overrides,
    });

    beforeEach(() => {
        gameRepository = {
            findActiveRunByUserId: mock.fn(async () => null),
            findRunById: mock.fn(),
            createRun: mock.fn(async (data: { userId: string; missionId: string; version: number }) =>
                createMockRun({ userId: data.userId, missionId: data.missionId, version: data.version })
            ),
            abandonRun: mock.fn(async () => true),
            abandonOtherActiveRuns: mock.fn(async () => 1),
            completeRunAtomically: mock.fn(async (_id, _u, data) =>
                createMockRun({
                    status: "completed",
                    completedAt: data.completedAt,
                    rewardStatus: data.rewardStatus,
                    grantedXp: data.grantedXp,
                    grantedCosmetics: data.grantedCosmetics,
                })
            ),
            hasUserReceivedReward: mock.fn(async () => false),
            recordRewardAtomically: mock.fn(async () => true),
            getRewardedMissionIds: mock.fn(async () => []),
            countCompletedRuns: mock.fn(async () => 0),
        } as unknown as IGameRepository;

        playerRepository = {
            findByUserId: mock.fn(),
            findOrCreateByUserId: mock.fn(async () => ({ ...mockProfileLevel1 })),
            updateCharacter: mock.fn(async (_u, charId) => ({
                ...mockProfileLevel1,
                characterId: charId,
            })),
            addXp: mock.fn(async (_u, delta) => ({
                ...mockProfileLevel1,
                totalXp: mockProfileLevel1.totalXp + delta,
            })),
            unlockItem: mock.fn(async (_u, item) => ({
                ...mockProfileLevel1,
                unlockedItems: [...mockProfileLevel1.unlockedItems, item],
            })),
        } as unknown as IPlayerRepository;

        service = new GameService(gameRepository, playerRepository);
    });

    describe("getGameMe & Isolation des joueurs", () => {
        it("renvoie la vue consolidée avec progression et apparences débloquées", async () => {
            const data = await service.getGameMe("player-alpha");

            assert.strictEqual(data.profile.userId, "player-alpha");
            assert.strictEqual(data.progress.currentLevel, 1);
            assert.strictEqual(data.activeCharacter?.id, "cadet-scout");
            assert.ok(data.availableCharacters.some((c) => c.id === "cadet-scout"));
            // cyber-runner est niveau 2, donc indisponible pour un joueur niveau 1
            assert.ok(!data.availableCharacters.some((c) => c.id === "cyber-runner"));
        });

        it("isole strictement les données entre deux joueurs différents", async () => {
            (playerRepository.findOrCreateByUserId as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async (uid: string) => ({
                    ...mockProfileLevel1,
                    userId: uid,
                    totalXp: uid === "player-beta" ? 500 : 0,
                })
            );

            const resAlpha = await service.getGameMe("player-alpha");
            const resBeta = await service.getGameMe("player-beta");

            assert.strictEqual(resAlpha.profile.userId, "player-alpha");
            assert.strictEqual(resAlpha.progress.currentLevel, 1);

            assert.strictEqual(resBeta.profile.userId, "player-beta");
            assert.strictEqual(resBeta.progress.currentLevel, 3); // 500 XP = Niveau 3
        });
    });

    describe("updateAppearance", () => {
        it("rejette la sélection d'un personnage verrouillé pour le niveau du joueur", async () => {
            await assert.rejects(
                async () => service.updateAppearance("player-alpha", { characterId: "cyber-runner" }),
                (err: unknown) => err instanceof ForbiddenError
            );
        });

        it("accepte la modification d'apparence lorsque le niveau requis est atteint", async () => {
            (playerRepository.findOrCreateByUserId as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => ({ ...mockProfileLevel2 })
            );

            const result = await service.updateAppearance("player-alpha", { characterId: "cyber-runner" });
            assert.strictEqual(result.profile.userId, "player-alpha");
            assert.strictEqual((playerRepository.updateCharacter as any).mock.calls.length, 1);
        });
    });

    describe("getMissions & Sécurité du catalogue", () => {
        it("ne divulgue JAMAIS les secrets de validation aux clients", async () => {
            const missions = await service.getMissions("player-alpha");

            for (const m of missions) {
                assert.strictEqual((m as any).validationSecrets, undefined);
                assert.ok(m.title);
                assert.ok(m.state);
            }
        });

        it("catégorise correctement l'état des missions (available vs locked)", async () => {
            const missions = await service.getMissions("player-alpha");

            const mission1 = missions.find((m) => m.id === "mission-1-beacons");
            const mission2 = missions.find((m) => m.id === "mission-2-sequence");

            assert.strictEqual(mission1?.state, "available"); // minLevel 1
            assert.strictEqual(mission2?.state, "locked"); // minLevel 2
        });

        it("marque la mission en 'already_rewarded' si le joueur a déjà touché la récompense", async () => {
            (gameRepository.getRewardedMissionIds as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => ["mission-1-beacons"]
            );

            const missions = await service.getMissions("player-alpha");
            const m1 = missions.find((m) => m.id === "mission-1-beacons");

            assert.strictEqual(m1?.state, "already_rewarded");
        });
    });

    describe("startMission & Règle des tentatives actives", () => {
        it("refuse le démarrage d'une mission inconnue", async () => {
            await assert.rejects(
                async () => service.startMission("player-alpha", "unknown-mission"),
                (err: unknown) => err instanceof NotFoundError
            );
        });

        it("refuse le démarrage d'une mission verrouillée", async () => {
            await assert.rejects(
                async () => service.startMission("player-alpha", "mission-2-sequence"),
                (err: unknown) => err instanceof ForbiddenError
            );
        });

        it("démarre une nouvelle tentative lorsqu'aucune tentative n'est active", async () => {
            const result = await service.startMission("player-alpha", "mission-1-beacons");

            assert.strictEqual(result.isResume, false);
            assert.strictEqual(result.run.missionId, "mission-1-beacons");
            assert.strictEqual(result.mission.state, "in_progress");
        });

        it("reprend la tentative active existante si le joueur relance la même mission (idempotence)", async () => {
            const existingRun = createMockRun({ id: "run-existing", missionId: "mission-1-beacons" });
            (gameRepository.findActiveRunByUserId as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => existingRun
            );

            const result = await service.startMission("player-alpha", "mission-1-beacons");

            assert.strictEqual(result.isResume, true);
            assert.strictEqual(result.run.id, "run-existing");
            assert.strictEqual((gameRepository.createRun as any).mock.calls.length, 0);
        });

        it("abandonne l'ancienne tentative active si le joueur commence une autre mission", async () => {
            (playerRepository.findOrCreateByUserId as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => ({ ...mockProfileLevel2 })
            );

            const activeRunM1 = createMockRun({ id: "run-m1", missionId: "mission-1-beacons" });
            (gameRepository.findActiveRunByUserId as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => activeRunM1
            );

            const result = await service.startMission("player-alpha", "mission-2-sequence");

            assert.strictEqual(result.isResume, false);
            assert.strictEqual((gameRepository.abandonOtherActiveRuns as any).mock.calls.length, 1);
            assert.strictEqual(result.run.missionId, "mission-2-sequence");
        });
    });

    describe("completeRun & Prévention stricte des doubles récompenses", () => {
        it("refuse la clôture si la tentative n'existe pas", async () => {
            (gameRepository.findRunById as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => null
            );

            await assert.rejects(
                async () => service.completeRun("player-alpha", "invalid-id", { durationSeconds: 15 }),
                (err: unknown) => err instanceof NotFoundError
            );
        });

        it("refuse la clôture d'une tentative appartenant à un autre joueur", async () => {
            const foreignRun = createMockRun({ userId: "pirate-user" });
            (gameRepository.findRunById as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => foreignRun
            );

            await assert.rejects(
                async () => service.completeRun("player-alpha", foreignRun.id, { durationSeconds: 15 }),
                (err: unknown) => err instanceof ForbiddenError
            );
        });

        it("rejette les résultats trop rapides (anti-triche / cohérence durée serveur)", async () => {
            const freshRun = createMockRun({
                startedAt: new Date(), // commencé il y a 0 seconde
            });
            (gameRepository.findRunById as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => freshRun
            );

            await assert.rejects(
                async () => service.completeRun("player-alpha", freshRun.id, { durationSeconds: 1 }),
                (err: unknown) => err instanceof BadRequestError
            );
        });

        it("rejette les objectifs incomplets (balises manquantes)", async () => {
            const run = createMockRun();
            (gameRepository.findRunById as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => run
            );

            await assert.rejects(
                async () =>
                    service.completeRun("player-alpha", run.id, {
                        durationSeconds: 15,
                        collectedItemIds: ["beacon-alpha"], // il manque beta et gamma
                    }),
                (err: unknown) => err instanceof BadRequestError
            );
        });

        it("valide la mission et attribue les récompenses lors d'une première complétion légitime", async () => {
            const run = createMockRun();
            (gameRepository.findRunById as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => run
            );

            const result = await service.completeRun("player-alpha", run.id, {
                durationSeconds: 15,
                collectedItemIds: ["beacon-alpha", "beacon-beta", "beacon-gamma"],
            });

            assert.strictEqual(result.status, "completed");
            assert.strictEqual(result.rewardStatus, "granted");
            assert.strictEqual(result.xpGranted, 100);
            assert.ok(result.cosmeticsGranted.includes("visor-neon-blue"));

            // Vérifie l'incrémentation atomique du profil
            assert.strictEqual((playerRepository.addXp as any).mock.calls.length, 1);
            assert.strictEqual((playerRepository.unlockItem as any).mock.calls.length, 1);
        });

        it("double clôture séquentielle : renvoie un statut stable sans recréditer d'XP", async () => {
            const alreadyCompletedRun = createMockRun({
                status: "completed",
                rewardStatus: "granted",
                grantedXp: 100,
            });
            (gameRepository.findRunById as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => alreadyCompletedRun
            );

            const result = await service.completeRun("player-alpha", alreadyCompletedRun.id, {
                durationSeconds: 15,
            });

            assert.strictEqual(result.status, "completed");
            assert.strictEqual(result.rewardStatus, "granted");
            assert.strictEqual(result.xpGranted, 0); // 0 XP additionnel
            assert.strictEqual((playerRepository.addXp as any).mock.calls.length, 0);
        });

        it("clôtures concurrentes : gère le conflit d'index unique sans doublon d'XP", async () => {
            const run = createMockRun();
            (gameRepository.findRunById as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => run
            );

            // Simule l'échec de recordRewardAtomically (code 11000 : une requête parallèle a déjà inséré)
            (gameRepository.recordRewardAtomically as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => false
            );

            const result = await service.completeRun("player-alpha", run.id, {
                durationSeconds: 15,
                collectedItemIds: ["beacon-alpha", "beacon-beta", "beacon-gamma"],
            });

            assert.strictEqual(result.rewardStatus, "already_granted");
            assert.strictEqual(result.xpGranted, 0);
            assert.strictEqual((playerRepository.addXp as any).mock.calls.length, 0);
        });

        it("tentative distincte sur une mission déjà récompensée : 0 XP et statut already_granted", async () => {
            const secondRun = createMockRun({ id: "run-second" });
            (gameRepository.findRunById as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => secondRun
            );
            (gameRepository.hasUserReceivedReward as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => true
            );

            const result = await service.completeRun("player-alpha", secondRun.id, {
                durationSeconds: 15,
                collectedItemIds: ["beacon-alpha", "beacon-beta", "beacon-gamma"],
            });

            assert.strictEqual(result.status, "completed");
            assert.strictEqual(result.rewardStatus, "already_granted");
            assert.strictEqual(result.xpGranted, 0);
            assert.strictEqual((playerRepository.addXp as any).mock.calls.length, 0);
        });
    });
});

