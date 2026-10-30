// employee.service.test.ts
import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert";
import { EmployeeService } from "./employee.service.js";
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from "../common/errors.js";
import type { IEmployeeRepository, Employee } from "./employee.types.js";

describe("EmployeeService", () => {
    let repository: IEmployeeRepository;
    let service: EmployeeService;

    beforeEach(() => {
        repository = {
            findAll: mock.fn(),
            findById: mock.fn(),
            create: mock.fn(),
            update: mock.fn(),
            delete: mock.fn(),
        } as unknown as IEmployeeRepository;

        service = new EmployeeService(repository);
    });

    describe("getAllEmployees", () => {
        it("retourne la liste des employés depuis le repository", async () => {
            const mockEmployees: Employee[] = [
                { id: "1", name: "Koffi", age: 25, job: "Technicien", createdBy: "user-1" } as Employee,
            ];
            (repository.findAll as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => mockEmployees
            );

            const result = await service.getAllEmployees({ job: "Technicien" });

            assert.deepStrictEqual(result, mockEmployees);
            assert.deepStrictEqual(
                (repository.findAll as any).mock.calls[0].arguments[0],
                { job: "Technicien" }
            );
        });

        it("fonctionne sans filtres (undefined)", async () => {
            (repository.findAll as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(async () => []);

            await service.getAllEmployees();

            assert.strictEqual((repository.findAll as any).mock.calls[0].arguments[0], undefined);
        });
    });

    describe("getEmployeeById", () => {
        it("retourne l'employé s'il existe", async () => {
            const mockEmployee = { id: "1", name: "Koffi" } as Employee;
            (repository.findById as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => mockEmployee
            );

            const result = await service.getEmployeeById("1");

            assert.deepStrictEqual(result, mockEmployee);
        });

        it("lève BadRequestError si l'id est vide", async () => {
            await assert.rejects(
                () => service.getEmployeeById(""),
                BadRequestError
            );
            // Le repository ne doit jamais être interrogé si l'id est invalide
            assert.strictEqual((repository.findById as any).mock.callCount(), 0);
        });

        it("lève BadRequestError si l'id ne contient que des espaces", async () => {
            await assert.rejects(
                () => service.getEmployeeById("   "),
                BadRequestError
            );
        });

        it("lève NotFoundError si l'employé n'existe pas", async () => {
            (repository.findById as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => null
            );

            await assert.rejects(
                () => service.getEmployeeById("999"),
                NotFoundError
            );
        });
    });

    describe("createEmployee", () => {
        const validDto = {
            name: "Koffi",
            age: 25,
            job: "Technicien",
            createdBy: "user-1",
        };

        it("crée l'employé avec les données nettoyées (trim)", async () => {
            const mockCreated = { id: "1", ...validDto } as Employee;
            (repository.create as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => mockCreated
            );

            const dtoWithSpaces = {
                name: "  Koffi  ",
                age: 25,
                job: "  Technicien  ",
                createdBy: "user-1",
            };

            const result = await service.createEmployee(dtoWithSpaces);

            assert.deepStrictEqual((repository.create as any).mock.calls[0].arguments[0], {
                name: "Koffi",
                age: 25,
                job: "Technicien",
                createdBy: "user-1",
            });
            assert.deepStrictEqual(result, mockCreated);
        });

        it("lève BadRequestError si name est vide", async () => {
            await assert.rejects(
                () => service.createEmployee({ ...validDto, name: "" }),
                BadRequestError
            );
        });

        it("lève BadRequestError si name ne contient que des espaces", async () => {
            await assert.rejects(
                () => service.createEmployee({ ...validDto, name: "   " }),
                BadRequestError
            );
        });

        it("lève BadRequestError si age n'est pas un number", async () => {
            await assert.rejects(
                () => service.createEmployee({ ...validDto, age: "25" as any }),
                BadRequestError
            );
        });

        it("lève BadRequestError si age est négatif ou nul", async () => {
            await assert.rejects(
                () => service.createEmployee({ ...validDto, age: 0 }),
                BadRequestError
            );
            await assert.rejects(
                () => service.createEmployee({ ...validDto, age: -5 }),
                BadRequestError
            );
        });

        it("lève BadRequestError si age est NaN", async () => {
            await assert.rejects(
                () => service.createEmployee({ ...validDto, age: NaN }),
                BadRequestError
            );
        });

        it("lève BadRequestError si job est vide", async () => {
            await assert.rejects(
                () => service.createEmployee({ ...validDto, job: "" }),
                BadRequestError
            );
        });

        it("lève UnauthorizedError si createdBy est absent", async () => {
            await assert.rejects(
                () => service.createEmployee({ ...validDto, createdBy: "" }),
                UnauthorizedError
            );
        });

        it("n'appelle jamais le repository si la validation échoue", async () => {
            await assert.rejects(() => service.createEmployee({ ...validDto, name: "" }));
            assert.strictEqual((repository.create as any).mock.callCount(), 0);
        });
    });

    describe("updateEmployee", () => {
        it("met à jour uniquement les champs fournis, nettoyés", async () => {
            const mockUpdated = { id: "1", name: "Koffi Updated" } as Employee;
            (repository.update as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => mockUpdated
            );

            const result = await service.updateEmployee("1", { name: "  Koffi Updated  " });

            assert.deepStrictEqual((repository.update as any).mock.calls[0].arguments[1], {
                name: "Koffi Updated",
            });
            assert.deepStrictEqual(result, mockUpdated);
        });

        it("lève BadRequestError si l'id est vide", async () => {
            await assert.rejects(
                () => service.updateEmployee("", { name: "Koffi" }),
                BadRequestError
            );
        });

        it("lève BadRequestError si name fourni est vide après trim", async () => {
            await assert.rejects(
                () => service.updateEmployee("1", { name: "   " }),
                BadRequestError
            );
        });

        it("lève BadRequestError si age fourni est invalide", async () => {
            await assert.rejects(
                () => service.updateEmployee("1", { age: -1 }),
                BadRequestError
            );
            await assert.rejects(
                () => service.updateEmployee("1", { age: "30" as any }),
                BadRequestError
            );
        });

        it("lève BadRequestError si job fourni est vide après trim", async () => {
            await assert.rejects(
                () => service.updateEmployee("1", { job: "   " }),
                BadRequestError
            );
        });

        it("lève NotFoundError si le repository ne trouve rien à mettre à jour", async () => {
            (repository.update as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => null
            );

            await assert.rejects(
                () => service.updateEmployee("999", { name: "Koffi" }),
                NotFoundError
            );
        });

        it("n'envoie que les champs explicitement fournis (objet vide si aucun champ)", async () => {
            (repository.update as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => ({ id: "1" } as Employee)
            );

            await service.updateEmployee("1", {});

            assert.deepStrictEqual((repository.update as any).mock.calls[0].arguments[1], {});
        });
    });

    describe("deleteEmployee", () => {
        const existingEmployee = {
            id: "1",
            name: "Koffi",
            createdBy: "user-1",
        } as Employee;

        it("supprime l'employé si l'utilisateur courant est bien le créateur", async () => {
            (repository.findById as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => existingEmployee
            );
            (repository.delete as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => true
            );

            await service.deleteEmployee("1", "user-1");

            assert.strictEqual((repository.delete as any).mock.calls[0].arguments[0], "1");
        });

        it("lève BadRequestError si l'id est vide", async () => {
            await assert.rejects(
                () => service.deleteEmployee("", "user-1"),
                BadRequestError
            );
        });

        it("lève UnauthorizedError si currentUserId est vide", async () => {
            await assert.rejects(
                () => service.deleteEmployee("1", ""),
                UnauthorizedError
            );
            // Le repository ne doit jamais être consulté sans utilisateur authentifié
            assert.strictEqual((repository.findById as any).mock.callCount(), 0);
        });

        it("lève NotFoundError si l'employé n'existe pas", async () => {
            (repository.findById as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => null
            );

            await assert.rejects(
                () => service.deleteEmployee("999", "user-1"),
                NotFoundError
            );
        });

        it("lève ForbiddenError si l'utilisateur courant n'est pas le créateur", async () => {
            (repository.findById as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => existingEmployee
            );

            await assert.rejects(
                () => service.deleteEmployee("1", "another-user"),
                ForbiddenError
            );
            // La suppression ne doit jamais être tentée si l'autorisation échoue
            assert.strictEqual((repository.delete as any).mock.callCount(), 0);
        });

        it("lève NotFoundError si le repository échoue à supprimer (race condition)", async () => {
            (repository.findById as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => existingEmployee
            );
            (repository.delete as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
                async () => false
            );

            await assert.rejects(
                () => service.deleteEmployee("1", "user-1"),
                NotFoundError
            );
        });
    });
});