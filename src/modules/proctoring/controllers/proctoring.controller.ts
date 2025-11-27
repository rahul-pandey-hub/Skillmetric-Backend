import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProctoringService } from '../services/proctoring.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('proctoring')
@Controller('proctoring')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProctoringController {
  constructor(private readonly proctoringService: ProctoringService) {}

  @Get('session/:id/violations')
  @ApiOperation({ summary: 'Get violations for a session' })
  async getSessionViolations(@Param('id') sessionId: string) {
    return this.proctoringService.getSessionViolations(sessionId);
  }

  @Get('exam/:id/sessions')
  @ApiOperation({ summary: 'Get active sessions for an exam' })
  async getExamSessions(@Param('id') examId: string) {
    return this.proctoringService.getExamSessions(examId);
  }

  @Get('session/:id')
  @ApiOperation({ summary: 'Get session details' })
  async getSessionDetails(@Param('id') sessionId: string) {
    return this.proctoringService.getSessionDetails(sessionId);
  }
}
