import "reflect-metadata";
import * as dotenv from "dotenv";

// Loaded and validated BEFORE anything else, including the AppModule
// import below. @nestjs/config's ConfigModule.forRoot({ validate }) is an
// ASYNC static method — when `validate` throws inside it, that becomes a
// rejected Promise sitting in the `imports` array, which does NOT reliably
// crash the process. This explicit, synchronous, top-level check is what
// actually guarantees "refuses to boot on missing/invalid env vars" (S12).
dotenv.config();
import { validateEnv } from "./config/env.validation";
validateEnv(process.env);

import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import fastifyCookie from "@fastify/cookie";
import fastifyHelmet from "@fastify/helmet";
import fastifyCompress from "@fastify/compress";
import fastifyMultipart from "@fastify/multipart";
import { AppModule } from "./app.module";
import { AccountLockedFilter } from "./common/filters/account-locked.filter";

async function bootstrap() {
  const adapter = new FastifyAdapter();

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
    rawBody: true,
  });

  const config = app.get(ConfigService);
  app.useLogger(app.get(Logger));

  await app.register(fastifyCookie, {
    secret: config.get<string>("COOKIE_SECRET"),
  });
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: config.get<string>("NODE_ENV") === "production" ? undefined : false,
  });
  await app.register(fastifyCompress);
  // 25MB ceiling matches the largest per-file limit (voice memos); the
  // per-upload-kind limits themselves are enforced in StorageService.
  await app.register(fastifyMultipart, {
    limits: { fileSize: 25 * 1024 * 1024 },
  });

  // Nest's Fastify adapter already registers a default
  // application/x-www-form-urlencoded parser (fast-querystring) that
  // Twilio's inbound SMS webhook body arrives through — no custom parser
  // needed here; see twilio.controller.ts for how it's consumed.

  // S12 — CORS locked to known origins, no wildcards in production.
  app.enableCors({
    origin: [config.get<string>("FRONTEND_URL")!, config.get<string>("ADMIN_URL")!],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AccountLockedFilter());

  app.setGlobalPrefix("api", { exclude: ["/health"] });

  if (config.get<string>("NODE_ENV") !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("TradPath API")
      .setDescription("Field service management platform API")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, document);
  }

  const port = config.get<string>("API_PORT") ?? "3001";
  await app.listen(Number(port), "0.0.0.0");
  console.log(`TradPath API listening on :${port}`);
}

bootstrap();
