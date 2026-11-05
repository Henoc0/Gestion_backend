import { beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert";
import { PlayerService } from "./player.service.js";
import { BadRequestError, ForbiddenError } from "../common/errors.js";
import type { IPlayerRepository, PlayerProfile } from "./player.types.js";

describe("SkillQuest - PlayerService", () => {
    let repository: IPlayerRepository;
    let service: PlayerService;

    const mockInitialProfile: PlayerProfile = {
        id: "profile-1",
        userId: "user-123",
        characterId: "cadet-scout",
        totalXp: 0,
        unlockedItems: ["badge-pioneer"],
    };

    beforeEach(() => {
        repository = {
            findByUserId: mock.fn(),
            findOrCreateByUserId: mock.fn(async () => mockInitialProfile),
            updateCharacter: mock.fn(),
            addXp: mock.fn(),
            unlockItem: mock.fn(),
        } as unknown as IPlayerRepository;

        service = new PlayerService(repository);
    });

    describe("getProfile", () => {
        it("lève une BadRequestError si userId est absent", async () => {
            await assert.rejects(
                async () => service.getProfile(""),
                (err: unknown) => err instanceof BadRequestError
            );
        });

        it("récupère ou initialise de façon idempotente le profil avec sa progression", async () => {
            const profile = await service.getProfile("user-123");

            assert.strictEqual(profile.userId, "user-123");
            assert.strictEqual(profile.characterId, "cadet-scout");
            assert.strictEqual(profile.progress.currentLevel, 1);
            assert.strictEqual(profile.progress.totalXp, 0);
            assert.strictEqual(profile.activeCharacter?.name, "Cadet Scout");
            assert.strictEqual((repository.findOrCreateByUserId as any).mock.calls.length, 1);
        });
    });

    describe("selectCharacter", () => {
        it("rejette un identifiant de personnage inconnu", async () => {
            await assert.rejects(
                async () => service.selectCharacter("user-123", "unknown-ninja"),
                (err: unknown) => err instanceof BadRequestError
            );
        });

        it("autorise la sélection du personnage de départ (niveau 1 requis)", async () => {
            (repository.updateCharacter as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => ({
                    ...mockInitialProfile,
                    characterId: "cadet-scout",
                })
            );

            const result = await service.selectCharacter("user-123", "cadet-scout");

            assert.strictEqual(result.characterId, "cadet-scout");
            assert.strictEqual(result.activeCharacter?.id, "cadet-scout");
        });

        it("refuse la sélection d'un personnage verrouillé (ex: niveau 2 requis mais joueur niveau 1)", async () => {
            // cyber-runner requiert le niveau 2 (100 XP), le mockInitialProfile a 0 XP (niveau 1)
            await assert.rejects(
                async () => service.selectCharacter("user-123", "cyber-runner"),
                (err: unknown) => {
                    assert.ok(err instanceof ForbiddenError);
                    assert.match((err as ForbiddenError).message, /Niveau 2 requis/);
                    return true;
                }
            );
        });

        it("autorise la sélection d'un personnage avancé lorsque le joueur a l'XP requis", async () => {
            const highLevelProfile: PlayerProfile = {
                ...mockInitialProfile,
                totalXp: 150, // Niveau 2
            };

            (repository.findOrCreateByUserId as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => highLevelProfile
            );

            (repository.updateCharacter as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => ({
                    ...highLevelProfile,
                    characterId: "cyber-runner",
                })
            );

            const result = await service.selectCharacter("user-123", "cyber-runner");

            assert.strictEqual(result.characterId, "cyber-runner");
            assert.strictEqual(result.progress.currentLevel, 2);
        });
    });

    describe("getCatalog", () => {
        it("retourne les personnages et cosmétiques officiels autorisés", () => {
            const catalog = service.getCatalog();

            assert.ok(catalog.characters.length >= 3);
            assert.ok(catalog.cosmetics.length >= 2);
            assert.strictEqual(catalog.defaultCharacterId, "cadet-scout");
        });
    });
});

