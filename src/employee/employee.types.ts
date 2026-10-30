import type { Employee } from "./employee.model.js";

export type { Employee };

export interface CreateEmployeeDto {
    name: string;
    age: number;
    job: string;
    createdBy: string;
}

export interface UpdateEmployeeDto {
    name?: string;
    age?: number;
    job?: string;
}

export interface EmployeeQueryParams {
    name?: string;
    job?: string;
    minAge?: number;
    maxAge?: number;
    page?: number;
    limit?: number;
    sortBy?: string;
    order?: "asc" | "desc";
}

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface IEmployeeRepository {
    findAll(filters?: EmployeeQueryParams): Promise<Employee[]>;
    count(filters?: EmployeeQueryParams): Promise<number>;
    findById(id: string): Promise<Employee | null>;
    create(data: CreateEmployeeDto): Promise<Employee>;
    update(id: string, data: UpdateEmployeeDto): Promise<Employee | null>;
    delete(id: string): Promise<boolean>;
}
