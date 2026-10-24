import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { aiCostFromUsage } from "@acm/shared";
import { MCP_INGEST, McpIngestPort, AiRunInput } from "../../domain/ports/mcp-ingest.port";
import { ReportWorkDto } from "../../interfaces/http/dto/report-work.dto";

export interface ReportWorkResult {
  recorded: true;
  aiCost: number;
}

@Injectable()
export class ReportWorkUseCase {
  constructor(@Inject(MCP_INGEST) private readonly ingest: McpIngestPort) {}

  async execute(dto: ReportWorkDto): Promise<ReportWorkResult> {
    const member = await this.ingest.getMemberRateByEmail(dto.memberEmail);
    if (!member) throw new NotFoundException(`Member ${dto.memberEmail} not found`);

    const prices = await this.ingest.getModelPrices();
    const aiRuns: AiRunInput[] = (dto.aiRuns ?? []).map((run) => ({
      model: run.model,
      agent: run.agent ?? null,
      tokensIn: run.tokensIn,
      tokensOut: run.tokensOut,
      costUsd: aiCostFromUsage({ model: run.model, tokensIn: run.tokensIn, tokensOut: run.tokensOut }, prices),
    }));
    const aiCost = Math.round(aiRuns.reduce((s, r) => s + r.costUsd, 0) * 100) / 100;

    await this.ingest.recordWork({
      taskId: dto.taskId,
      memberId: member.id,
      minutes: dto.minutes,
      ratePerHourSnapshot: member.ratePerHour,
      note: dto.output ?? null,
      aiRuns,
    });

    return { recorded: true, aiCost };
  }
}
