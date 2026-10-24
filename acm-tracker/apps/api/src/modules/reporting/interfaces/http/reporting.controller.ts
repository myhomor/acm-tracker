import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../../../auth/auth.guard";
import { ProjectCostBreakdownUseCase } from "../../application/use-cases/project-cost-breakdown.use-case";
import { CostByPersonUseCase } from "../../application/use-cases/cost-by-person.use-case";
import { WeeklyCostSeriesUseCase } from "../../application/use-cases/weekly-cost-series.use-case";
import { TodaySummaryUseCase } from "../../application/use-cases/today-summary.use-case";
import { TeamTodayUseCase } from "../../application/use-cases/team-today.use-case";
import { MarginSummaryUseCase } from "../../application/use-cases/margin-summary.use-case";
import { DailyReportUseCase } from "../../application/use-cases/daily-report.use-case";

function daysAgo(days: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
}

function dayBounds(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from.getTime() + 86_400_000);
  return { from, to };
}

function weekStart(): Date {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
}

@UseGuards(AuthGuard)
@Controller()
export class ReportingController {
  constructor(
    private readonly projectBreakdown: ProjectCostBreakdownUseCase,
    private readonly byPerson: CostByPersonUseCase,
    private readonly weekly: WeeklyCostSeriesUseCase,
    private readonly todaySummary: TodaySummaryUseCase,
    private readonly teamToday: TeamTodayUseCase,
    private readonly marginSummary: MarginSummaryUseCase,
    private readonly dailyReport: DailyReportUseCase,
  ) {}

  @Get("projects/:id/cost") projectCost(@Param("id") id: string) {
    return this.projectBreakdown.execute(id);
  }

  @Get("reports/by-person") costByPerson(@Query("projectId") projectId?: string) {
    return this.byPerson.execute(projectId);
  }

  @Get("reports/weekly") weeklyCost(@Query("weeks") weeks?: string, @Query("projectId") projectId?: string) {
    return this.weekly.execute(weeks ? Number(weeks) : 8, projectId || undefined);
  }

  @Get("reports/daily") daily(@Query("days") days?: string, @Query("projectId") projectId?: string) {
    return this.dailyReport.execute(daysAgo(Math.max(1, Number(days) || 30)), projectId || undefined);
  }

  @Get("reports/today") today() {
    const { from, to } = dayBounds();
    return this.todaySummary.execute(from, to, weekStart());
  }

  @Get("reports/team-today") teamTodayRoute() {
    const { from, to } = dayBounds();
    return this.teamToday.execute(from, to);
  }

  @Get("reports/margin-summary") marginSummaryRoute() {
    return this.marginSummary.execute();
  }
}
