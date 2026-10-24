import { Inject, Injectable } from "@nestjs/common";
import type { TimeEntry } from "@acm/shared";
import {
  TIME_ENTRY_REPOSITORY,
  TimeEntryRepositoryPort,
} from "../../domain/ports/time-entry.repository.port";
import { MEMBER_RATE_READER, MemberRateReaderPort } from "../../domain/ports/member-rate.port";
import { CreateTimeEntryDto } from "../../interfaces/http/dto/create-time-entry.dto";

@Injectable()
export class CreateManualEntryUseCase {
  constructor(
    @Inject(TIME_ENTRY_REPOSITORY) private readonly repo: TimeEntryRepositoryPort,
    @Inject(MEMBER_RATE_READER) private readonly rates: MemberRateReaderPort,
  ) {}

  async execute(memberId: string, dto: CreateTimeEntryDto): Promise<TimeEntry> {
    const ratePerHourSnapshot = await this.rates.getRatePerHour(memberId);
    return this.repo.create({
      taskId: dto.taskId,
      memberId,
      minutes: dto.minutes,
      billable: dto.billable ?? true,
      ratePerHourSnapshot,
      note: dto.note ?? null,
      startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
    });
  }
}
