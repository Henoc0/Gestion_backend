export interface AuthUserPayload {
    id: string;
    userId?: string;
    _id?: string;
    sub?: string;
    email?: string;
    name?: string;
    [key: string]: unknown;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthUserPayload;
        }
    }
}
