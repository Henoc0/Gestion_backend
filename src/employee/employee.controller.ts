import type { NextFunction, Request, Response } from "express";
import type { EmployeeService } from "./employee.service.js";
import type { EmployeeQueryParams } from "./employee.types.js";
import { UnauthorizedError } from "../common/errors.js";

/**
 * Extrait l'identifiant de l'utilisateur authentifié depuis la requête Express.
 */
function getAuthUserId(req: Request): string {
    const user = req.user;
    const userId = user?.id || user?.userId || user?._id || user?.sub;
    if (!userId) {
        throw new UnauthorizedError("Utilisateur non authentifié");
    }
    return String(userId);
}

export class EmployeeController {
    constructor(private readonly employeeService: EmployeeService) { }

    getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { name, job, minAge, maxAge, page, limit, sortBy, order } = req.query;

            const filters: EmployeeQueryParams = {
                ...(typeof name === "string" && { name }),
                ...(typeof job === "string" && { job }),
                ...(typeof minAge === "string" && !isNaN(Number(minAge)) && { minAge: Number(minAge) }),
                ...(typeof maxAge === "string" && !isNaN(Number(maxAge)) && { maxAge: Number(maxAge) }),
                ...(typeof page === "string" && !isNaN(Number(page)) && { page: Number(page) }),
                ...(typeof limit === "string" && !isNaN(Number(limit)) && { limit: Number(limit) }),
                ...(typeof sortBy === "string" && { sortBy }),
                ...((order === "asc" || order === "desc") && { order }),
            };

            const employees = await this.employeeService.getAllEmployees(filters);
            const total = await this.employeeService.countEmployees(filters);
            const currentPage = filters.page ?? 1;
            const effectiveLimit = filters.limit ?? (total > 0 ? total : 1);
            const totalPages = Math.ceil(total / effectiveLimit) || 1;

            res.status(200).json({
                success: true,
                count: employees.length,
                data: employees,
                pagination: {
                    page: currentPage,
                    limit: filters.limit ?? employees.length,
                    total,
                    totalPages,
                },
            });
        } catch (error) {
            next(error);
        }
    };

    getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params;
            const employee = await this.employeeService.getEmployeeById(id as string);
            res.status(200).json({
                success: true,
                data: employee
            });
        } catch (error) {
            next(error);
        }
    };

    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = getAuthUserId(req);
            const { name, age, job } = req.body;

            const newEmployee = await this.employeeService.createEmployee({
                name,
                age: typeof age === "string" ? Number(age) : age,
                job,
                createdBy: userId,
            });

            res.status(201).json({
                success: true,
                message: "Employee created successfully",
                data: newEmployee
            });
        } catch (error) {
            next(error);
        }
    };

    update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params;
            const userId = getAuthUserId(req);
            const { name, age, job } = req.body;

            const updatedEmployee = await this.employeeService.updateEmployee(id as string, {
                ...(name !== undefined && { name }),
                ...(age !== undefined && { age: typeof age === "string" ? Number(age) : age }),
                ...(job !== undefined && { job })
            }, userId);

            res.status(200).json({
                success: true,
                message: "Employee updated successfully",
                data: updatedEmployee
            });
        } catch (error) {
            next(error);
        }
    };

    delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params;
            const userId = getAuthUserId(req);

            await this.employeeService.deleteEmployee(id as string, userId);

            res.status(200).json({
                success: true,
                message: `Employee with ID '${id}' deleted successfully`
            });
        } catch (error) {
            next(error);
        }
    };
}
