export const MEMBER_RATE_READER = Symbol("MEMBER_RATE_READER");

export interface MemberRateReaderPort {
  getRatePerHour(memberId: string): Promise<number>;
}
