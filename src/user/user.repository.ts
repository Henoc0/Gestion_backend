import { UserModel, type User } from "./user.model.js";
import type { IUserRepository, RegisterDto } from "./user.types.js";

/**
 * Normalise un document Mongoose en objet User API propre (sans mot de passe).
 * Compatible avec la règle tsconfig exactOptionalPropertyTypes.
 */
function toUser(doc: { _id: unknown; name: string; email: string; isActive: boolean; createdAt?: Date; updatedAt?: Date }): User {
    const user: User = {
        id: String(doc._id),
        name: doc.name,
        email: doc.email,
        isActive: doc.isActive,
        
    };

    if (doc.createdAt) {
        user.createdAt = doc.createdAt;
    }
    if (doc.updatedAt) {
        user.updatedAt = doc.updatedAt;
    }

    return user;
}

/**
 * Repository MongoDB pour les Utilisateurs.
 */
export const userRepository: IUserRepository = {
    async findByEmail(email: string): Promise<User | null> {
        const doc = await UserModel.findOne({ email }).lean();
        return doc ? toUser(doc) : null;
    },

    async findByEmailWithPassword(email: string): Promise<(User & { password?: string }) | null> {
        const doc = await UserModel.findOne({ email }).lean();
        if (!doc) return null;

        const userWithPassword: User & { password?: string } = toUser(doc);
        if (doc.password) {
            userWithPassword.password = doc.password;
        }

        return userWithPassword;
    },

    async findById(id: string): Promise<User | null> {
        const doc = await UserModel.findById(id).lean();
        return doc ? toUser(doc) : null;
    },

    async create(data: RegisterDto): Promise<User> {
        const doc = await UserModel.create(data);
        return toUser(doc.toObject());
    },
};

export default userRepository;
