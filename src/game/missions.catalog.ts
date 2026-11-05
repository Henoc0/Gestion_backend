/**
 * Catalogue versionné des missions de SkillQuest.
 * 
 * Défini directement en TypeScript pour éviter toute surcharge de collection ou d'administration.
 * Les secrets de validation (ex: séquence secrète) restent strictement sur le serveur et ne
 * sont JAMAIS renvoyés au client.
 */

export interface MissionObjective {
    id: string;
    type: "collect" | "activate_sequence" | "reach_extraction" | "interact";
    description: string;
    targetCount?: number;
}

export interface MissionRepeatPolicy {
    repeatable: boolean;
    rewardPolicy: "once_ever" | "always";
}

export interface MissionDefinition {
    id: string;
    version: number;
    title: string;
    description: string;
    environmentId: string;
    minLevel: number;
    rewardXp: number;
    rewardCosmetics: string[];
    repeatPolicy: MissionRepeatPolicy;
    objectives: MissionObjective[];
    /** Paramètres internes de validation serveur (non exposés à l'API) */
    validationSecrets?: {
        expectedSequence?: string[];
        requiredItemIds?: string[];
        requiredExtractionZone?: string;
    };
    /** Durée minimale plausible en secondes pour éviter les complétions instantanées */
    minDurationSeconds: number;
}

export const MISSIONS_CATALOG: readonly MissionDefinition[] = [
    {
        id: "mission-1-beacons",
        version: 1,
        title: "Pionnier des Balises",
        description: "Explorez le secteur alpha et retrouvez les 3 balises de détresse dispersées.",
        environmentId: "sector-alpha",
        minLevel: 1,
        rewardXp: 100,
        rewardCosmetics: ["visor-neon-blue"],
        repeatPolicy: {
            repeatable: true,
            rewardPolicy: "once_ever",
        },
        objectives: [
            {
                id: "collect-beacons",
                type: "collect",
                description: "Localiser et récupérer les 3 balises de transmission",
                targetCount: 3,
            },
        ],
        validationSecrets: {
            requiredItemIds: ["beacon-alpha", "beacon-beta", "beacon-gamma"],
        },
        minDurationSeconds: 3,
    },
    {
        id: "mission-2-sequence",
        version: 1,
        title: "Relais de Puissance",
        description: "Déchiffrez et activez les terminaux du nexus dans le bon ordre logique.",
        environmentId: "nexus-core",
        minLevel: 2,
        rewardXp: 200,
        rewardCosmetics: ["suit-stealth-black"],
        repeatPolicy: {
            repeatable: true,
            rewardPolicy: "once_ever",
        },
        objectives: [
            {
                id: "activate-consoles",
                type: "activate_sequence",
                description: "Résoudre la séquence de déverrouillage du réacteur",
                targetCount: 3,
            },
        ],
        validationSecrets: {
            expectedSequence: ["node-A", "node-C", "node-B"],
        },
        minDurationSeconds: 5,
    },
    {
        id: "mission-3-extraction",
        version: 1,
        title: "Infiltration et Extraction",
        description: "Récupérez le noyau de données classifié à l'avant-poste et rejoignez la zone d'évacuation.",
        environmentId: "outpost-gamma",
        minLevel: 3,
        rewardXp: 300,
        rewardCosmetics: [],
        repeatPolicy: {
            repeatable: true,
            rewardPolicy: "once_ever",
        },
        objectives: [
            {
                id: "retrieve-core",
                type: "collect",
                description: "Sécuriser le noyau de données",
                targetCount: 1,
            },
            {
                id: "reach-extraction",
                type: "reach_extraction",
                description: "Atteindre la zone d'extraction héliportée",
            },
        ],
        validationSecrets: {
            requiredItemIds: ["data-core-omega"],
            requiredExtractionZone: "extraction-zone-omega",
        },
        minDurationSeconds: 7,
    },
] as const;

/**
 * Filtre les données sensibles de la mission avant envoi au client web.
 */
export function sanitizeMissionForClient(mission: MissionDefinition): Omit<MissionDefinition, "validationSecrets"> {
    const { validationSecrets: _, ...publicMission } = mission;
    return publicMission;
}

export function getMissionById(missionId: string): MissionDefinition | undefined {
    return MISSIONS_CATALOG.find((m) => m.id === missionId);
}

