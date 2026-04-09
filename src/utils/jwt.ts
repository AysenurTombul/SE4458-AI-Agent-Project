import jwt, { SignOptions, Secret } from "jsonwebtoken";
import type { StringValue } from "ms";
import env from "../config/env";
import { Role } from "@prisma/client";

export type JwtPayload = {
  userId: string;
  role: Role;
};

const signOptions: SignOptions = {
  expiresIn: env.JWT_EXPIRES_IN as StringValue
};

export const signToken = (payload: JwtPayload) =>
  jwt.sign(payload, env.JWT_SECRET as Secret, signOptions);

export const verifyToken = (token: string) => jwt.verify(token, env.JWT_SECRET) as JwtPayload;
