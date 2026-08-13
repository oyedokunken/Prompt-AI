import { type Request, type Response, type NextFunction } from "express";
import { type ZodSchema, ZodError } from "zod";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Request body is invalid.",
        fields: errors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
