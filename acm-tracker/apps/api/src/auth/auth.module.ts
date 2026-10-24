import { Global, Module } from "@nestjs/common";
import { AUTH_PROVIDER } from "./auth-provider.interface";
import { NoAuthProvider } from "./no-auth.provider";
import { AuthGuard } from "./auth.guard";
import { AuthController } from "./auth.controller";

@Global()
@Module({
  controllers: [AuthController],
  providers: [NoAuthProvider, AuthGuard, { provide: AUTH_PROVIDER, useExisting: NoAuthProvider }],
  exports: [AUTH_PROVIDER, AuthGuard],
})
export class AuthModule {}
