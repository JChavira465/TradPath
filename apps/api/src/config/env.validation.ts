import { plainToInstance } from "class-transformer";
import { IsIn, IsNotEmpty, IsNumberString, IsOptional, IsString, MinLength, validateSync } from "class-validator";

class EnvironmentVariables {
  @IsIn(["development", "test", "production"])
  NODE_ENV!: string;

  @IsNumberString()
  API_PORT!: string;

  @IsString()
  @IsNotEmpty()
  FRONTEND_URL!: string;

  @IsString()
  @IsNotEmpty()
  ADMIN_URL!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  DIRECT_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  // Refuses to boot if under 32 chars — this is the S12 hard requirement.
  @IsString()
  @MinLength(32, { message: "JWT_SECRET must be at least 32 characters" })
  JWT_SECRET!: string;

  @IsString()
  @MinLength(32, { message: "COOKIE_SECRET must be at least 32 characters" })
  COOKIE_SECRET!: string;

  @IsString()
  @MinLength(32, { message: "MFA_ENCRYPTION_KEY must be at least 32 characters (hex-encoded 32 bytes)" })
  MFA_ENCRYPTION_KEY!: string;

  @IsOptional()
  @IsString()
  STRIPE_SECRET_KEY?: string;

  @IsOptional()
  @IsString()
  STRIPE_WEBHOOK_SECRET?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((e) => Object.values(e.constraints ?? {}).join(", "))
      .join("\n  - ");
    throw new Error(
      `Invalid environment configuration — refusing to boot:\n  - ${messages}`,
    );
  }

  return validatedConfig;
}
