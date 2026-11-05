import { describe, it } from "node:test";
import assert from "node:assert";
import {
    calculateLevelFromXp,
    calculateLevelProgress,
    getXpRequiredForLevel,
} from "./level.utils.js";

describe("SkillQuest - Level & XP System (level.utils)", () => {
    describe("getXpRequiredForLevel", () => {
        it("calcule les seuils corrects selon la formule 100 * (N - 1)^2", () => {
            assert.strictEqual(getXpRequiredForLevel(1), 0);
            assert.strictEqual(getXpRequiredForLevel(2), 100);
            assert.strictEqual(getXpRequiredForLevel(3), 400);
            assert.strictEqual(getXpRequiredForLevel(4), 900);
            assert.strictEqual(getXpRequiredForLevel(5), 1600);
        });

        it("gère les niveaux négatifs ou nuls en repliant sur le niveau 1", () => {
            assert.strictEqual(getXpRequiredForLevel(0), 0);
            assert.strictEqual(getXpRequiredForLevel(-5), 0);
        });
    });

    describe("calculateLevelFromXp", () => {
        it("détermine le niveau 1 pour tout XP entre 0 et 99", () => {
            assert.strictEqual(calculateLevelFromXp(0), 1);
            assert.strictEqual(calculateLevelFromXp(50), 1);
            assert.strictEqual(calculateLevelFromXp(99), 1);
        });

        it("détermine le niveau 2 dès 100 XP jusqu'à 399 XP", () => {
            assert.strictEqual(calculateLevelFromXp(100), 2);
            assert.strictEqual(calculateLevelFromXp(250), 2);
            assert.strictEqual(calculateLevelFromXp(399), 2);
        });

        it("détermine le niveau 3 dès 400 XP jusqu'à 899 XP", () => {
            assert.strictEqual(calculateLevelFromXp(400), 3);
            assert.strictEqual(calculateLevelFromXp(650), 3);
            assert.strictEqual(calculateLevelFromXp(899), 3);
        });

        it("détermine le niveau 4 dès 900 XP", () => {
            assert.strictEqual(calculateLevelFromXp(900), 4);
            assert.strictEqual(calculateLevelFromXp(1599), 4);
        });

        it("gère les XP négatifs en retournant le niveau 1", () => {
            assert.strictEqual(calculateLevelFromXp(-50), 1);
        });
    });

    describe("calculateLevelProgress", () => {
        it("fournit les données correctes de progression pour un joueur débutant (0 XP)", () => {
            const progress = calculateLevelProgress(0);

            assert.strictEqual(progress.currentLevel, 1);
            assert.strictEqual(progress.totalXp, 0);
            assert.strictEqual(progress.currentLevelBaseXp, 0);
            assert.strictEqual(progress.nextLevelThresholdXp, 100);
            assert.strictEqual(progress.xpInCurrentLevel, 0);
            assert.strictEqual(progress.xpRequiredForNextLevel, 100);
            assert.strictEqual(progress.progressPercent, 0);
        });

        it("fournit une progression à 50% pour 50 XP au niveau 1", () => {
            const progress = calculateLevelProgress(50);

            assert.strictEqual(progress.currentLevel, 1);
            assert.strictEqual(progress.xpInCurrentLevel, 50);
            assert.strictEqual(progress.xpRequiredForNextLevel, 100);
            assert.strictEqual(progress.progressPercent, 50);
        });

        it("calcule correctement la progression au niveau 2 (seuil 100 -> 400)", () => {
            // 250 XP total : 100 XP pour le lvl 2, reste 150 XP sur 300 nécessaires = 50%
            const progress = calculateLevelProgress(250);

            assert.strictEqual(progress.currentLevel, 2);
            assert.strictEqual(progress.currentLevelBaseXp, 100);
            assert.strictEqual(progress.nextLevelThresholdXp, 400);
            assert.strictEqual(progress.xpInCurrentLevel, 150);
            assert.strictEqual(progress.xpRequiredForNextLevel, 300);
            assert.strictEqual(progress.progressPercent, 50);
        });
    });
});

