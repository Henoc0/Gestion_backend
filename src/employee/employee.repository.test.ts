// employee.repository.test.ts
import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { EmployeeModel } from "./employee.model.js";
import { employeeRepository } from "./employee.repository.js";

describe("employeeRepository", () => {
    // Restaure toutes les méthodes mockées après chaque test pour éviter les fuites entre tests
    afterEach(() => {
        mock.restoreAll();
    });

    describe("findAll", () => {
        it("retourne la liste vide des filtres si aucun filtre fourni", async () => {
            const mockDocs = [
                { _id: "1", name: "Koffi", age: 25, job: "Technicien", createdBy: "user-1" },
            ];
            const leanMock = mock.fn(async () => mockDocs);
            mock.method(EmployeeModel, "find", () => ({ lean: leanMock }));

            const result = await employeeRepository.findAll();

            assert.deepStrictEqual((EmployeeModel.find as any).mock.calls[0].arguments[0], {});
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result?.[0]?.id, "1"); // vérifie la transformation _id -> id
            assert.strictEqual(result?.[0]?.createdBy, "user-1"); // vérifie String(createdBy)
        });

        it("construit un filtre name avec regex insensible à la casse", async () => {
            const leanMock = mock.fn(async () => []);
            mock.method(EmployeeModel, "find", () => ({ lean: leanMock }));

            await employeeRepository.findAll({ name: "Koffi" });

            assert.deepStrictEqual((EmployeeModel.find as any).mock.calls[0].arguments[0], {
                name: { $regex: "Koffi", $options: "i" },
            });
        });

        it("construit un filtre job avec regex insensible à la casse", async () => {
            const leanMock = mock.fn(async () => []);
            mock.method(EmployeeModel, "find", () => ({ lean: leanMock }));

            await employeeRepository.findAll({ job: "Technicien" });

            assert.deepStrictEqual((EmployeeModel.find as any).mock.calls[0].arguments[0], {
                job: { $regex: "Technicien", $options: "i" },
            });
        });

        it("construit un filtre age avec minAge et maxAge combinés", async () => {
            const leanMock = mock.fn(async () => []);
            mock.method(EmployeeModel, "find", () => ({ lean: leanMock }));

            await employeeRepository.findAll({ minAge: 20, maxAge: 40 });

            assert.deepStrictEqual((EmployeeModel.find as any).mock.calls[0].arguments[0], {
                age: { $gte: 20, $lte: 40 },
            });
        });

        it("construit un filtre age avec seulement minAge", async () => {
            const leanMock = mock.fn(async () => []);
            mock.method(EmployeeModel, "find", () => ({ lean: leanMock }));

            await employeeRepository.findAll({ minAge: 20 });

            assert.deepStrictEqual((EmployeeModel.find as any).mock.calls[0].arguments[0], {
                age: { $gte: 20 },
            });
        });

        it("construit un filtre age avec seulement maxAge", async () => {
            const leanMock = mock.fn(async () => []);
            mock.method(EmployeeModel, "find", () => ({ lean: leanMock }));

            await employeeRepository.findAll({ maxAge: 40 });

            assert.deepStrictEqual((EmployeeModel.find as any).mock.calls[0].arguments[0], {
                age: { $lte: 40 },
            });
        });

        it("ignore createdAt/updatedAt dans le mapping si absents du document", async () => {
            const mockDocs = [{ _id: "1", name: "Koffi", age: 25, job: "Technicien", createdBy: "user-1" }];
            const leanMock = mock.fn(async () => mockDocs);
            mock.method(EmployeeModel, "find", () => ({ lean: leanMock }));

            const result = await employeeRepository.findAll();

            assert.strictEqual(result?.[0]?.createdAt, undefined);
            assert.strictEqual(result?.[0]?.updatedAt, undefined);
        });

        it("applique le tri lorsque la méthode sort est disponible", async () => {
            const mockDocs = [{ _id: "1", name: "Koffi", age: 25, job: "Technicien", createdBy: "user-1" }];
            const leanMock = mock.fn(async () => mockDocs);
            const sortMock = mock.fn(() => ({ lean: leanMock }));
            mock.method(EmployeeModel, "find", () => ({ sort: sortMock }));

            const result = await employeeRepository.findAll({ sortBy: "age", order: "asc" });

            assert.strictEqual(sortMock.mock.calls.length, 1);
            assert.deepStrictEqual((sortMock as any).mock.calls[0].arguments[0], { age: 1 });
            assert.strictEqual(result.length, 1);
        });
    });

    describe("findById", () => {
        it("retourne l'employé transformé si le document existe", async () => {
            const mockDoc = { _id: "1", name: "Koffi", age: 25, job: "Technicien", createdBy: "user-1" };
            const leanMock = mock.fn(async () => mockDoc);
            mock.method(EmployeeModel, "findById", () => ({ lean: leanMock }));

            const result = await employeeRepository.findById("1");

            assert.strictEqual((EmployeeModel.findById as any).mock.calls[0].arguments[0], "1");
            assert.deepStrictEqual(result, {
                id: "1",
                name: "Koffi",
                age: 25,
                job: "Technicien",
                createdBy: "user-1",
            });
        });

        it("retourne null si le document n'existe pas", async () => {
            const leanMock = mock.fn(async () => null);
            mock.method(EmployeeModel, "findById", () => ({ lean: leanMock }));

            const result = await employeeRepository.findById("999");

            assert.strictEqual(result, null);
        });
    });

    describe("create", () => {
        it("crée le document et retourne l'employé transformé", async () => {
            const mockDocData = {
                _id: "1",
                name: "Koffi",
                age: 25,
                job: "Technicien",
                createdBy: "user-1",
            };
            const mockDoc = {
                toObject: () => mockDocData,
            };
            mock.method(EmployeeModel, "create", async () => mockDoc);

            const dto = { name: "Koffi", age: 25, job: "Technicien", createdBy: "user-1" };
            const result = await employeeRepository.create(dto);

            assert.deepStrictEqual((EmployeeModel.create as any).mock.calls[0].arguments[0], dto);
            assert.deepStrictEqual(result, {
                id: "1",
                name: "Koffi",
                age: 25,
                job: "Technicien",
                createdBy: "user-1",
            });
        });
    });

    describe("update", () => {
        it("met à jour et retourne l'employé transformé si trouvé", async () => {
            const mockDoc = { _id: "1", name: "Koffi Updated", age: 26, job: "Technicien", createdBy: "user-1" };
            const leanMock = mock.fn(async () => mockDoc);
            mock.method(EmployeeModel, "findByIdAndUpdate", () => ({ lean: leanMock }));

            const result = await employeeRepository.update("1", { name: "Koffi Updated" });

            assert.deepStrictEqual((EmployeeModel.findByIdAndUpdate as any).mock.calls[0].arguments, [
                "1",
                { name: "Koffi Updated" },
                { new: true },
            ]);
            assert.strictEqual(result?.name, "Koffi Updated");
        });

        it("retourne null si l'employé n'existe pas", async () => {
            const leanMock = mock.fn(async () => null);
            mock.method(EmployeeModel, "findByIdAndUpdate", () => ({ lean: leanMock }));

            const result = await employeeRepository.update("999", { name: "X" });

            assert.strictEqual(result, null);
        });

        it("passe toujours { new: true } pour récupérer le document mis à jour", async () => {
            const leanMock = mock.fn(async () => null);
            mock.method(EmployeeModel, "findByIdAndUpdate", () => ({ lean: leanMock }));

            await employeeRepository.update("1", {});

            assert.deepStrictEqual(
                (EmployeeModel.findByIdAndUpdate as any).mock.calls[0].arguments[2],
                { new: true }
            );
        });
    });

    describe("delete", () => {
        it("retourne true si le document a été supprimé", async () => {
            mock.method(EmployeeModel, "findByIdAndDelete", async () => ({ _id: "1" }));

            const result = await employeeRepository.delete("1");

            assert.strictEqual((EmployeeModel.findByIdAndDelete as any).mock.calls[0].arguments[0], "1");
            assert.strictEqual(result, true);
        });

        it("retourne false si aucun document n'a été trouvé pour suppression", async () => {
            mock.method(EmployeeModel, "findByIdAndDelete", async () => null);

            const result = await employeeRepository.delete("999");

            assert.strictEqual(result, false);
        });
    });
});