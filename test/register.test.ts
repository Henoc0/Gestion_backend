// test/integration/auth.register.integration.test.ts
import { describe, it, before, after, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../src/app.js";
import { UserModel } from "../src/user/user.model.js"; 
import { setupTestDB, teardownTestDB } from "./helpers/db.helper.js";

const validUser = {
    name: "Koffi Beni",
    email: "koffi@test.com",
    password: "Password1!",
};

describe("POST /auth/register (intégration)", () => {
    let app: Express;

    before(async () => {
        await setupTestDB();
        // Force la création des index (dont l'unicité de l'email) avant les tests
        await UserModel.init();
        app = createApp();
    });

    after(async () => {
        await teardownTestDB();
    });

    beforeEach(async () => {
        await UserModel.deleteMany({}); // base propre pour chaque test, index conservés
        // Le controller fait console.error à chaque erreur : on le coupe pour garder une sortie lisible
        mock.method(console, "error", () => {});
    });

    afterEach(() => {
        mock.restoreAll();
    });

    const register = (body: unknown) => request(app).post("/auth/register").send(body as object);

    describe("inscription réussie", () => {
        it("retourne 201 avec les infos de l'utilisateur créé", async () => {
            const res = await register(validUser);

            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.message, "User registered");
            assert.strictEqual(res.body.data.name, validUser.name);
            assert.strictEqual(res.body.data.email, validUser.email);
        });

        it("ne renvoie JAMAIS le mot de passe (ni en clair, ni hashé) dans la réponse", async () => {
            const res = await register(validUser);

            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.data.password, undefined);
        });

        it("persiste l'utilisateur en base avec un mot de passe hashé", async () => {
            await register(validUser);

            const saved = await UserModel.findOne({ email: validUser.email });
            assert.ok(saved, "l'utilisateur devrait exister en base");
            assert.notStrictEqual(saved.password, validUser.password);
            assert.ok((saved.password as any).length > validUser.password.length);
        });

        it("normalise l'email en minuscules", async () => {
            const res = await register({ ...validUser, email: "Koffi@Test.COM" });

            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.data.email, "koffi@test.com");
        });

        it("supprime les espaces autour du nom", async () => {
            const res = await register({ ...validUser, name: "  Koffi Beni  " });

            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.data.name, "Koffi Beni");
        });

        it("ignore les champs non prévus (mass assignment) comme isActive", async () => {
            const res = await register({ ...validUser, isActive: false, role: "admin" });

            assert.strictEqual(res.status, 201);
            const saved = await UserModel.findOne({ email: validUser.email });
            assert.strictEqual(saved?.isActive, true);
            assert.strictEqual((saved as any)?.role, undefined);
        });
    });

    describe("données invalides → 400, rien n'est créé en base", () => {
        const invalidPayloads: Array<[string, unknown]> = [
            ["corps vide", {}],
            ["name manquant", { email: validUser.email, password: validUser.password }],
            ["email manquant", { name: validUser.name, password: validUser.password }],
            ["password manquant", { name: validUser.name, email: validUser.email }],
            ["name de type number", { ...validUser, name: 123 }],
            ["email de type number", { ...validUser, email: 123 }],
            ["password de type number", { ...validUser, password: 12345678 }],
            ["name composé uniquement d'espaces", { ...validUser, name: "   " }],
            ["email sans @", { ...validUser, email: "kofftest.com" }],
            ["email sans domaine", { ...validUser, email: "koffi@" }],
            ["email de plus de 254 caractères", { ...validUser, email: `${"a".repeat(250)}@test.com` }],
            ["password trop court", { ...validUser, password: "Aa1!" }],
            ["password trop long (> 20)", { ...validUser, password: `Password1!${"x".repeat(15)}` }],
            ["password trop faible (lettres seulement)", { ...validUser, password: "abcdefgh" }],
            ["injection NoSQL dans l'email", { ...validUser, email: { $gt: "" } }],
        ];

        for (const [label, payload] of invalidPayloads) {
            it(`rejette : ${label}`, async () => {
                const res = await register(payload);

                assert.strictEqual(res.status, 400);
                assert.strictEqual(await UserModel.countDocuments(), 0);
            });
        }

        it("rejette un JSON mal formé avec une erreur client (4xx)", async () => {
            const res = await request(app)
                .post("/auth/register")
                .set("Content-Type", "application/json")
                .send('{"email": ');

            assert.ok(res.status >= 400 && res.status < 500, `statut reçu : ${res.status}`);
            assert.strictEqual(await UserModel.countDocuments(), 0);
        });
    });

    describe("email déjà utilisé", () => {
        it("rejette une seconde inscription avec le même email (400)", async () => {
            await register(validUser);

            const res = await register({ ...validUser, name: "Autre Nom" });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(await UserModel.countDocuments(), 1);
        });

        it("rejette aussi le même email avec une casse différente (400)", async () => {
            await register(validUser);

            const res = await register({ ...validUser, email: "KOFFI@TEST.COM" });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(await UserModel.countDocuments(), 1);
        });

        it("gère deux inscriptions simultanées avec le même email (une seule réussit)", async () => {
            const [a, b] = await Promise.all([register(validUser), register(validUser)]);

            const statuses = [a.status, b.status].sort();
            assert.strictEqual(statuses[0], 201);
            assert.ok(statuses[1] >= 400 && statuses[1] < 500, `statut du perdant : ${statuses[1]}`);
            assert.strictEqual(await UserModel.countDocuments(), 1);
        });
    });
});