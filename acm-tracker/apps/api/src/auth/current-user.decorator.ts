import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthedUser } from "./auth-provider.interface";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthedUser =>
    ctx.switchToHttp().getRequest().user,
);
