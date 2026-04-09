import bcrypt from "bcryptjs";

export const hashPassword = async (raw: string) => bcrypt.hash(raw, 10);

export const verifyPassword = async (raw: string, hash: string) => bcrypt.compare(raw, hash);
