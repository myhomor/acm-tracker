import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

function resolveCorsOrigin(value?: string): boolean | string[] | null {
  if (value === undefined) return null;
  if (value === "*" || value === "true") return true;
  return value.split(",").map((origin) => origin.trim()).filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const corsOrigin = resolveCorsOrigin(process.env.CORS_ORIGIN);
  if (corsOrigin !== null) app.enableCors({ origin: corsOrigin, credentials: true });
  app.setGlobalPrefix("api");
  await app.listen(process.env.API_PORT ?? 4000);
}
bootstrap();
