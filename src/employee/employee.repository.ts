import { EmployeeModel, type Employee } from "./employee.model.js";
import type { CreateEmployeeDto, IEmployeeRepository, UpdateEmployeeDto, EmployeeQueryParams } from "./employee.types.js";

/**
 * Transforme un document Mongoose en objet Employee propre pour l'API.
 * Convertit `_id` → `id` et `createdBy` → `string`.
 */
function toEmployee(doc: { _id: unknown; name: string; age: number; job: string; createdBy: unknown; createdAt?: Date; updatedAt?: Date }): Employee {
    const employee: Employee = {
        id: String(doc._id),
        name: doc.name,
        age: doc.age,
        job: doc.job,
        createdBy: String(doc.createdBy),
    };

    if (doc.createdAt) {
        employee.createdAt = doc.createdAt;
    }
    if (doc.updatedAt) {
        employee.updatedAt = doc.updatedAt;
    }

    return employee;
}

/**
 * Échappe les caractères spéciaux pour éviter les vulnérabilités ReDoS / injection Regex.
 */
function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFilterQuery(filters?: EmployeeQueryParams): Record<string, unknown> {
    const query: Record<string, unknown> = {};

    if (filters?.name) {
        query.name = { $regex: escapeRegex(filters.name), $options: "i" };
    }

    if (filters?.job) {
        query.job = { $regex: escapeRegex(filters.job), $options: "i" };
    }

    if (filters?.minAge !== undefined || filters?.maxAge !== undefined) {
        const ageFilter: Record<string, number> = {};
        if (filters?.minAge !== undefined) {
            ageFilter.$gte = filters.minAge;
        }
        if (filters?.maxAge !== undefined) {
            ageFilter.$lte = filters.maxAge;
        }
        query.age = ageFilter;
    }

    return query;
}

/**
 * Repository MongoDB pour les employés.
 * Chaque méthode délègue au modèle Mongoose et normalise le résultat.
 */
export const employeeRepository: IEmployeeRepository = {

    async findAll(filters?: EmployeeQueryParams) {
        const query = buildFilterQuery(filters);

        const page = Math.max(1, filters?.page ?? 1);
        const limit = filters?.limit ? Math.min(100, Math.max(1, filters.limit)) : undefined;

        let mongooseQuery = EmployeeModel.find(query);

        // Tri sécurisé avec whitelist de champs autorisés pour le frontend
        if (typeof (mongooseQuery as any).sort === "function") {
            const allowedSortFields = ["name", "age", "job", "createdAt", "updatedAt"];
            const sortField = filters?.sortBy && allowedSortFields.includes(filters.sortBy) ? filters.sortBy : "createdAt";
            const sortOrder = filters?.order === "asc" ? 1 : -1;
            mongooseQuery = (mongooseQuery as any).sort({ [sortField]: sortOrder });
        }

        if (limit && typeof (mongooseQuery as any).skip === "function") {
            mongooseQuery = mongooseQuery.skip((page - 1) * limit).limit(limit);
        }

        const docs = await mongooseQuery.lean();
        return docs.map(toEmployee);
    },

    async count(filters?: EmployeeQueryParams): Promise<number> {
        const query = buildFilterQuery(filters);
        return EmployeeModel.countDocuments(query);
    },

    async findById(id: string) {
        const doc = await EmployeeModel.findById(id).lean();
        return doc ? toEmployee(doc) : null;
    },

    async create(data: CreateEmployeeDto) {
        const doc = await EmployeeModel.create(data);
        return toEmployee(doc.toObject());
    },

    async update(id: string, data: UpdateEmployeeDto) {
        const doc = await EmployeeModel.findByIdAndUpdate(id, data, { new: true }).lean();
        return doc ? toEmployee(doc) : null;
    },

    async delete(id: string) {
        const result = await EmployeeModel.findByIdAndDelete(id);
        return result !== null;
    },
};

export default employeeRepository;
