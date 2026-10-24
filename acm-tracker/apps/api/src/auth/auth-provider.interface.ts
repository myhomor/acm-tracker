export interface AuthedUser {
  memberId: string;
  email: string;
  name: string;
}

export const AUTH_PROVIDER = Symbol("AUTH_PROVIDER");

export interface AuthProvider {
  getCurrentUser(req: unknown): Promise<AuthedUser>;
  readonly enforces: boolean;
}
