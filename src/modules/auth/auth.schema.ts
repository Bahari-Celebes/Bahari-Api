import { z } from "zod";

export const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(["admin", "cooperative_manager", "operator", "reviewer"]),
    cooperativeId: z.string().uuid().optional(),
  })
  .refine(
    (data) => {
      // cooperative_manager & operator must be linked to a cooperative.
      if (data.role === "cooperative_manager" || data.role === "operator") {
        return !!data.cooperativeId;
      }
      return true;
    },
    { message: "cooperativeId is required for cooperative_manager and operator roles" }
  );

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
