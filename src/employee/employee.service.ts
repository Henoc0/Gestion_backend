import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from "../common/errors.js";
import type { CreateEmployeeDto, IEmployeeRepository, UpdateEmployeeDto, Employee, EmployeeQueryParams } from "./employee.types.js";

export class EmployeeService {
    constructor(private readonly employeeRepository: IEmployeeRepository) {}

    async getAllEmployees(filters?: EmployeeQueryParams): Promise<Employee[]> {
        return this.employeeRepository.findAll(filters);
    }

    async countEmployees(filters?: EmployeeQueryParams): Promise<number> {
        return typeof this.employeeRepository.count === "function" 
            ? this.employeeRepository.count(filters) 
            : 0;
    }

    async getEmployeeById(id: string): Promise<Employee> {
        if (!id || id.trim() === "") {
            throw new BadRequestError("Employee ID is required");
        }

        const employee = await this.employeeRepository.findById(id);
        if (!employee) {
            throw new NotFoundError(`Employee with ID '${id}' not found`);
        }

        return employee;
    }

    async createEmployee(dto: CreateEmployeeDto): Promise<Employee> {
        if (!dto.name || dto.name.trim() === "") {
            throw new BadRequestError("Name is required and cannot be empty");
        }

        if (typeof dto.age !== "number" || isNaN(dto.age) || dto.age <= 0) {
            throw new BadRequestError("Valid positive age is required");
        }

        if (!dto.job || dto.job.trim() === "") {
            throw new BadRequestError("Job is required and cannot be empty");
        }

        if (!dto.createdBy || dto.createdBy.trim() === "") {
            throw new UnauthorizedError("User identification is required to create an employee");
        }

        return this.employeeRepository.create({
            name: dto.name.trim(),
            age: dto.age,
            job: dto.job.trim(),
            createdBy: dto.createdBy,
        });
    }

    async updateEmployee(id: string, dto: UpdateEmployeeDto, currentUserId?: string): Promise<Employee> {
        if (!id || id.trim() === "") {
            throw new BadRequestError("Employee ID is required");
        }

        if (dto.name !== undefined && dto.name.trim() === "") {
            throw new BadRequestError("Name cannot be empty");
        }

        if (dto.age !== undefined && (typeof dto.age !== "number" || isNaN(dto.age) || dto.age <= 0)) {
            throw new BadRequestError("Age must be a valid positive number");
        }

        if (dto.job !== undefined && dto.job.trim() === "") {
            throw new BadRequestError("Job cannot be empty");
        }

        if (currentUserId) {
            const existing = await this.employeeRepository.findById(id);
            if (!existing) {
                throw new NotFoundError(`Employee with ID '${id}' not found`);
            }
            if (existing.createdBy !== currentUserId) {
                throw new ForbiddenError("Vous n'êtes pas autorisé à modifier cet employé car vous ne l'avez pas créé");
            }
        }

        const updated = await this.employeeRepository.update(id, {
            ...(dto.name !== undefined && { name: dto.name.trim() }),
            ...(dto.age !== undefined && { age: dto.age }),
            ...(dto.job !== undefined && { job: dto.job.trim() })
        });

        if (!updated) {
            throw new NotFoundError(`Employee with ID '${id}' not found`);
        }

        return updated;
    }

    /**
     * Supprime un employé après avoir vérifié que l'utilisateur actuel est le créateur.
     */
    async deleteEmployee(id: string, currentUserId: string): Promise<void> {
        if (!id || id.trim() === "") {
            throw new BadRequestError("Employee ID is required");
        }

        if (!currentUserId || currentUserId.trim() === "") {
            throw new UnauthorizedError("User authentication is required");
        }

        const employee = await this.employeeRepository.findById(id);
        if (!employee) {
            throw new NotFoundError(`Employee with ID '${id}' not found`);
        }

        // Vérification de sécurité : Seul le créateur peut supprimer cet employé
        if (employee.createdBy !== currentUserId) {
            throw new ForbiddenError("Vous n'êtes pas autorisé à supprimer cet employé car vous ne l'avez pas créé");
        }

        const deleted = await this.employeeRepository.delete(id);
        if (!deleted) {
            throw new NotFoundError(`Employee with ID '${id}' not found`);
        }
    }
}
