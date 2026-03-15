import { z } from "zod";

export const userRoleSchema = z.enum(["tenant-admin", "project-admin", "reader"]);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(256),
});
