import { Module } from "@nestjs/common";
import { StaticWebModule } from "./static-web/static-web.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { MembersModule } from "./modules/members/members.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { TimeEntriesModule } from "./modules/time-entries/time-entries.module";
import { ModelPricingModule } from "./modules/model-pricing/model-pricing.module";
import { ReportingModule } from "./modules/reporting/reporting.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { McpModule } from "./modules/mcp/mcp.module";
import { TimerModule } from "./modules/timer/timer.module";
import { WorkspaceSettingsModule } from "./modules/workspace-settings/workspace-settings.module";

@Module({
  imports: [
    StaticWebModule.forRoot(),
    PrismaModule,
    AuthModule,
    MembersModule,
    ProjectsModule,
    TasksModule,
    TimeEntriesModule,
    ModelPricingModule,
    ReportingModule,
    DocumentsModule,
    NotificationsModule,
    McpModule,
    TimerModule,
    WorkspaceSettingsModule,
  ],
})
export class AppModule {}
