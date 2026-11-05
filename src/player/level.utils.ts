/**
 * Utilitaires pour le calcul centralisé du niveau et de la progression XP de SkillQuest.
 * 
 * Formule imposée :
 * XP requis pour atteindre le niveau N = 100 * (N - 1)^2
 * - Niveau 1 : 0 XP
 * - Niveau 2 : 100 XP
 * - Niveau 3 : 400 XP
 * - Niveau 4 : 900 XP
 */

export interface PlayerLevelProgress {
    currentLevel: number;
    totalXp: number;
    currentLevelBaseXp: number;
    nextLevelThresholdXp: number;
    xpInCurrentLevel: number;
    xpRequiredForNextLevel: number;
    progressPercent: number;
}

/**
 * Calcule l'XP seuil requis pour atteindre un niveau donné.
 * Niveau 1 -> 0 XP
 * Niveau 2 -> 100 XP
 * Niveau 3 -> 400 XP
 */
export function getXpRequiredForLevel(level: number): number {
    const validLevel = Math.max(1, Math.floor(level));
    return 100 * Math.pow(validLevel - 1, 2);
}

/**
 * Détermine le niveau atteint à partir du cumul total de points d'XP.
 * Formule inverse : N = Math.floor(Math.sqrt(totalXp / 100)) + 1
 */
export function calculateLevelFromXp(totalXp: number): number {
    const safeXp = Math.max(0, Math.floor(totalXp || 0));
    return Math.floor(Math.sqrt(safeXp / 100)) + 1;
}

/**
 * Calcule toutes les métriques nécessaires à l'affichage de la barre de progression en jeu.
 */
export function calculateLevelProgress(totalXp: number): PlayerLevelProgress {
    const safeXp = Math.max(0, Math.floor(totalXp || 0));
    const currentLevel = calculateLevelFromXp(safeXp);

    const currentLevelBaseXp = getXpRequiredForLevel(currentLevel);
    const nextLevelThresholdXp = getXpRequiredForLevel(currentLevel + 1);

    const xpInCurrentLevel = safeXp - currentLevelBaseXp;
    const xpRequiredForNextLevel = nextLevelThresholdXp - currentLevelBaseXp;

    const progressRatio = xpRequiredForNextLevel > 0 
        ? (xpInCurrentLevel / xpRequiredForNextLevel) * 100 
        : 100;

    const progressPercent = Math.min(100, Math.max(0, Math.round(progressRatio)));

    return {
        currentLevel,
        totalXp: safeXp,
        currentLevelBaseXp,
        nextLevelThresholdXp,
        xpInCurrentLevel,
        xpRequiredForNextLevel,
        progressPercent,
    };
}

