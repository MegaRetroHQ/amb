import { z } from "zod";
export declare const createAgentSchema: z.ZodObject<{
    name: z.ZodString;
    role: z.ZodString;
    capabilities: z.ZodNullable<z.ZodOptional<z.ZodUnknown>>;
}, z.core.$strip>;
export declare const updateAgentSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=agents.d.ts.map