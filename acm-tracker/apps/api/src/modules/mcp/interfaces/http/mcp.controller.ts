import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../../../auth/auth.guard";
import { ReportWorkUseCase } from "../../application/use-cases/report-work.use-case";
import { RecentReportsUseCase } from "../../application/use-cases/recent-reports.use-case";
import { GetMcpConfigUseCase } from "../../application/use-cases/get-mcp-config.use-case";
import { ReportWorkDto } from "./dto/report-work.dto";

@UseGuards(AuthGuard)
@Controller("mcp")
export class McpController {
  constructor(
    private readonly reportWork: ReportWorkUseCase,
    private readonly recentReports: RecentReportsUseCase,
    private readonly getConfig: GetMcpConfigUseCase,
  ) {}

  @Post("report-work") report(@Body() dto: ReportWorkDto) {
    return this.reportWork.execute(dto);
  }

  @Get("reports") reports() {
    return this.recentReports.execute(20);
  }

  @Get("config") config() {
    return this.getConfig.execute();
  }
}
