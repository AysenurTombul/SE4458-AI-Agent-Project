import { Role } from "@prisma/client";
import prisma from "../lib/prisma";
import { RegisterInput, LoginInput } from "../schemas/auth.schema";
import { hashPassword, verifyPassword } from "../utils/password";
import { AppError } from "../utils/errors";
import { signToken } from "../utils/jwt";

const sanitizeUser = (user: { id: string; email: string; fullName: string; role: Role }) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: user.role
});

export const registerUser = async (input: RegisterInput) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError("Email already registered", 409);
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      fullName: input.fullName,
      password: await hashPassword(input.password),
      role: input.role ?? Role.GUEST
    }
  });

  const token = signToken({ userId: user.id, role: user.role });
  return { token, user: sanitizeUser(user) };
};

export const loginUser = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

  const isValid = await verifyPassword(input.password, user.password);
  if (!isValid) {
    throw new AppError("Invalid credentials", 401);
  }

  const token = signToken({ userId: user.id, role: user.role });
  return { token, user: sanitizeUser(user) };
};
