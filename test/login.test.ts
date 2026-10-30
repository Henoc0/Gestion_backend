// test/login.test.ts
import { describe, it, before, after, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import request from "supertest";
import jwt from "jsonwebtoken";
import type { Express } from "express";
import { createApp } from "../src/app.js";
import { UserModel } from "../src/user/user.model.js"; 
import { EmployeeModel } from "../src/employee/employee.model.js";
import { setupTestDB, teardownTestDB } from "./helpers/db.helper.js";

const validUser = {
    name: "Koffi Beni",
    email: "koffi@test.com",
    password: "Password1!",
};

const JWT_SECRET = process.env.SECRET_JWT_TOKEN as string; // celui qu'utilise authMiddleware

describe("Authentification ", () => {
    let app: Express;

    before(async () => {
        await setupTestDB();
        await UserModel.init();
        app = createApp();
    });

    after(async () => {
        await teardownTestDB();
    });

    beforeEach(async () => {
        await UserModel.deleteMany({});
        await EmployeeModel.deleteMany({});
        mock.method(console, "error", () => {});
    });

    afterEach(() => {
        mock.restoreAll();
    });

    // --- Helpers -----------------------------------------------------------

    const login = (body: unknown) => request(app).post("/auth/login").send(body as object);

    /** Inscrit l'utilisateur via l'API (vrai hash bcrypt) puis se connecte et renvoie le token. */
    async function registerAndLogin(): Promise<string> {
        const reg = await request(app).post("/auth/register").send(validUser);
        assert.strictEqual(reg.status, 201, "l'inscription préalable doit réussir");

        const res = await login({ email: validUser.email, password: validUser.password });
        assert.strictEqual(res.status, 200, "la connexion doit réussir");
        return res.body.token as string;
    }

    // --- Login -------------------------------------------------------------

    describe("POST /auth/login", () => {
        describe("connexion réussie", () => {
            it("retourne 200 avec un token JWT", async () => {
                const token = await registerAndLogin();

                assert.strictEqual(typeof token, "string");
                assert.strictEqual(token.split(".").length, 3);
            });

            it("émet un token vérifiable, avec expiration, un identifiant utilisateur et sans mot de passe", async () => {
                const token = await registerAndLogin();

                // Échoue ici si la clé de signature (config.jwt.secret) diffère de celle de authMiddleware
                const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;

                assert.strictEqual(typeof decoded.exp, "number", "le token doit expirer");
                assert.ok(
                    decoded.id || decoded.userId || decoded._id || decoded.sub,
                    "le payload doit contenir un identifiant (id, userId, _id ou sub)"
                );
                assert.strictEqual(decoded.password, undefined);
            });

            it("ne renvoie aucun hash de mot de passe dans la réponse", async () => {
                await request(app).post("/auth/register").send(validUser);

                const res = await login({ email: validUser.email, password: validUser.password });

                assert.strictEqual(res.body.password, undefined);
                assert.ok(!JSON.stringify(res.body).includes("$2"), "un hash bcrypt a fuité");
            });

            it("accepte l'email dans une casse différente", async () => {
                await request(app).post("/auth/register").send(validUser);

                const res = await login({ email: "KOFFI@TEST.COM", password: validUser.password });

                assert.strictEqual(res.status, 200);
            });
        });

        describe("identifiants incorrects → 401", () => {
            it("rejette un email inconnu", async () => {
                const res = await login({ email: "inconnu@test.com", password: validUser.password });

                assert.strictEqual(res.status, 401);
            });

            it("rejette un mauvais mot de passe", async () => {
                await request(app).post("/auth/register").send(validUser);

                const res = await login({ email: validUser.email, password: "Wrong1234!" });

                assert.strictEqual(res.status, 401);
            });

            it("renvoie exactement la même réponse pour un email inconnu et un mauvais mot de passe (anti-énumération)", async () => {
                await request(app).post("/auth/register").send(validUser);

                const unknownEmail = await login({ email: "inconnu@test.com", password: "Wrong1234!" });
                const wrongPassword = await login({ email: validUser.email, password: "Wrong1234!" });

                assert.strictEqual(unknownEmail.status, wrongPassword.status);
                assert.deepStrictEqual(unknownEmail.body, wrongPassword.body);
            });
        });

        describe("données invalides → 400", () => {
            const invalidPayloads: Array<[string, unknown]> = [
                ["corps vide", {}],
                ["email manquant", { password: validUser.password }],
                ["password manquant", { email: validUser.email }],
                ["email de type number", { email: 123, password: validUser.password }],
                ["password de type number", { email: validUser.email, password: 12345678 }],
                ["email mal formé", { email: "koffitest.com", password: validUser.password }],
                ["password trop court", { email: validUser.email, password: "Aa1!" }],
                ["password trop long (> 20)", { email: validUser.email, password: `Password1!${"x".repeat(15)}` }],
                ["injection NoSQL dans l'email", { email: { $gt: "" }, password: validUser.password }],
                ["injection NoSQL dans le password", { email: validUser.email, password: { $ne: null } }],
            ];

            for (const [label, payload] of invalidPayloads) {
                it(`rejette : ${label}`, async () => {
                    await request(app).post("/auth/register").send(validUser);

                    const res = await login(payload);

                    assert.strictEqual(res.status, 400);
                    assert.strictEqual(res.body.token, undefined);
                });
            }

            it("rejette un JSON mal formé avec une erreur client (4xx)", async () => {
                const res = await request(app)
                    .post("/auth/login")
                    .set("Content-Type", "application/json")
                    .send('{"email": ');

                assert.ok(res.status >= 400 && res.status < 500, `statut reçu : ${res.status}`);
            });
        });
    });

    // --- Routes protégées --------------------------------------------------

    describe("accès aux routes protégées (/employees)", () => {
        it("flux complet : le token du login donne accès à GET /employees", async () => {
            const token = await registerAndLogin();

            const res = await request(app).get("/employees").set("Authorization", `Bearer ${token}`);

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
        });

        it("flux complet : POST /employees enregistre l'utilisateur connecté comme créateur", async () => {
            const token = await registerAndLogin();
            const user = await UserModel.findOne({ email: validUser.email });
            assert.ok(user);

            const res = await request(app)
                .post("/employees")
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "Employé Test", age: 30, job: "Technicien" });

            assert.strictEqual(res.status, 201);
            assert.strictEqual(String(res.body.data.createdBy), String(user._id));
        });

        describe("requêtes refusées → 401", () => {
            it("rejette une requête sans header Authorization", async () => {
                const res = await request(app).get("/employees");

                assert.strictEqual(res.status, 401);
            });

            const badHeaders: Array<[string, string]> = [
                ["schéma incorrect (Basic)", "Basic abc123"],
                ["Bearer sans token", "Bearer"],
                ["token qui n'est pas un JWT", "Bearer pas-un-jwt"],
            ];

            for (const [label, header] of badHeaders) {
                it(`rejette : ${label}`, async () => {
                    const res = await request(app).get("/employees").set("Authorization", header);

                    assert.strictEqual(res.status, 401);
                });
            }

            it("rejette un token signé avec une mauvaise clé", async () => {
                const forged = jwt.sign({ id: "pirate" }, "mauvaise-cle", { expiresIn: "1h" });

                const res = await request(app).get("/employees").set("Authorization", `Bearer ${forged}`);

                assert.strictEqual(res.status, 401);
            });

            it("rejette un token expiré", async () => {
                const expired = jwt.sign(
                    { id: "user-1", exp: Math.floor(Date.now() / 1000) - 60 },
                    JWT_SECRET
                );

                const res = await request(app).get("/employees").set("Authorization", `Bearer ${expired}`);

                assert.strictEqual(res.status, 401);
            });

            it("rejette un token dont le payload a été modifié (signature invalide)", async () => {
                const token = await registerAndLogin();
                const [header, , signature] = token.split(".");
                const fakePayload = Buffer.from(JSON.stringify({ id: "pirate" })).toString("base64url");

                const res = await request(app)
                    .get("/employees")
                    .set("Authorization", `Bearer ${header}.${fakePayload}.${signature}`);

                assert.strictEqual(res.status, 401);
            });

            it("rejette la création d'un employé avec un token valide mais sans identifiant utilisateur", async () => {
                const anonymousToken = jwt.sign({ foo: "bar" }, JWT_SECRET, { expiresIn: "1h" });

                const res = await request(app)
                    .post("/employees")
                    .set("Authorization", `Bearer ${anonymousToken}`)
                    .send({ name: "Employé Test", age: 30, job: "Technicien" });

                assert.strictEqual(res.status, 401);
                assert.strictEqual(await EmployeeModel.countDocuments(), 0);
            });
        });
    });

    describe("GET /auth/me", () => {
        it("retourne le profil de l'utilisateur connecté avec un token valide", async () => {
            const token = await registerAndLogin();

            const res = await request(app)
                .get("/auth/me")
                .set("Authorization", `Bearer ${token}`);

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.data.email, validUser.email);
            assert.strictEqual(res.body.data.name, validUser.name);
            assert.strictEqual(res.body.data.password, undefined);
        });

        it("rejette l'accès à /auth/me sans header Authorization", async () => {
            const res = await request(app).get("/auth/me");
            assert.strictEqual(res.status, 401);
        });
    });

    describe("POST /auth/logout", () => {
        it("retourne 200 et confirme la déconnexion", async () => {
            const res = await request(app).post("/auth/logout");

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.message, "Déconnexion réussie");
        });
    });
});