import { model, Schema, SchemaTypes } from "mongoose";

/**
 * Type représentant un employé tel qu'il est retourné par l'API (Gestion Employé).
 */
export interface Employee {
    id: string;
    name: string;
    age: number;
    job: string;
    createdBy: string;
    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * Type interne du document Mongoose pour la gestion des employés.
 */
interface EmployeeDocument {
    name: string;
    age: number;
    job: string;
    createdBy: Schema.Types.ObjectId | string;
}

const employeeSchema = new Schema<EmployeeDocument>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        age: {
            type: Number,
            required: true,
            min: 1,
        },
        job: {
            type: String,
            required: true,
            trim: true,
        },
        createdBy: {
            type: SchemaTypes.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

export const EmployeeModel = model<EmployeeDocument>("Employee", employeeSchema);
