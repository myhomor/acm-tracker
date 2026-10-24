import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { AUTH_PROVIDER, AuthProvider } from "./auth-provider.interface";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AUTH_PROVIDER) private auth: AuthProvider) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    req.user = await this.auth.getCurrentUser(req);
    return true;
  }
}
