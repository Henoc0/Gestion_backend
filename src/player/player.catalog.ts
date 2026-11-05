/**
 * Catalogue statique contrôlé par le serveur pour les personnages et cosmétiques de SkillQuest.
 * 
 * Aucune URL de modèle 3D inventée ni binaire stocké en base de données.
 * Le serveur stocke et valide uniquement les identifiants autorisés et leurs règles d'accès.
 */

export interface CharacterItem {
    id: string;
    name: string;
    description: string;
    requiredLevel: number;
    requiredUnlockItem?: string;
    isDefault?: boolean;
}

export interface CosmeticItem {
    id: string;
    name: string;
    type: "badge" | "head" | "suit" | "accessory";
    description: string;
    requiredLevel: number;
    isDefault?: boolean;
}

export const CHARACTER_CATALOG: readonly CharacterItem[] = [
    {
        id: "cadet-scout",
        name: "Cadet Scout",
        description: "Personnage agile conçu pour la reconnaissance initiale.",
        requiredLevel: 1,
        isDefault: true,
    },
    {
        id: "cyber-runner",
        name: "Cyber Runner",
        description: "Spécialiste de la vitesse pour les parcours d'extraction chronométrés.",
        requiredLevel: 2,
    },
    {
        id: "void-seeker",
        name: "Void Seeker",
        description: "Explorateur des zones profondes, résistant aux énigmes complexes.",
        requiredLevel: 3,
    },
] as const;

export const COSMETIC_CATALOG: readonly CosmeticItem[] = [
    {
        id: "badge-pioneer",
        name: "Badge Pionnier",
        type: "badge",
        description: "Badge commémoratif accordé à tout nouvel aventurier.",
        requiredLevel: 1,
        isDefault: true,
    },
    {
        id: "visor-neon-blue",
        name: "Visière Néon Cyan",
        type: "head",
        description: "Interface visuelle cybernétique avec filtres d'obscurité.",
        requiredLevel: 2,
    },
    {
        id: "suit-stealth-black",
        name: "Combinaison Infiltrateur",
        type: "suit",
        description: "Revêtement composite minimisant la détection environnementale.",
        requiredLevel: 3,
    },
] as const;

export const DEFAULT_CHARACTER_ID = "cadet-scout";
export const DEFAULT_UNLOCKED_ITEMS = ["badge-pioneer"];

export function getCharacterById(id: string): CharacterItem | undefined {
    return CHARACTER_CATALOG.find((c) => c.id === id);
}

export function getCosmeticById(id: string): CosmeticItem | undefined {
    return COSMETIC_CATALOG.find((item) => item.id === id);
}

export function isValidCharacterId(id: string): boolean {
    return CHARACTER_CATALOG.some((c) => c.id === id);
}

export function isCharacterUnlockedForPlayer(
    characterId: string,
    playerLevel: number,
    playerUnlockedItems: string[]
): boolean {
    const character = getCharacterById(characterId);
    if (!character) return false;

    // Débloqué si le niveau minimum requis est atteint
    if (playerLevel >= character.requiredLevel) {
        return true;
    }

    // Ou si un objet/jeton de déblocage spécifique est possédé
    if (character.requiredUnlockItem && playerUnlockedItems.includes(character.requiredUnlockItem)) {
        return true;
    }

    return false;
}

