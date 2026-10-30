// test/helpers/db.ts
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongoServer: MongoMemoryServer | undefined;

export async function setupTestDB(): Promise<void> {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
}

export async function teardownTestDB(): Promise<void> {
    await mongoose.disconnect();
    await mongoServer?.stop();
}