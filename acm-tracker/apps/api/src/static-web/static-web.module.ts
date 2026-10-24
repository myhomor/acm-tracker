import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { DynamicModule, Module } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";

function resolveWebDistDir(env: NodeJS.ProcessEnv): string | null {
  const configured = env.WEB_DIST_DIR;
  if (!configured) return null;
  const rootPath = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  return existsSync(rootPath) ? rootPath : null;
}

@Module({})
export class StaticWebModule {
  static forRoot(env: NodeJS.ProcessEnv = process.env): DynamicModule {
    const rootPath = resolveWebDistDir(env);
    const imports = rootPath
      ? [ServeStaticModule.forRoot({ rootPath, exclude: ["/api(.*)"] })]
      : [];
    return { module: StaticWebModule, imports };
  }
}
