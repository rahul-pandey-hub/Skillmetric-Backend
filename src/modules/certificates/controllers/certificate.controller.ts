import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  Res,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { CertificateService } from '../services/certificate.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../users/schemas/user.schema';

@ApiTags('certificates')
@Controller('certificates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  @Post('result/:resultId/generate')
  @Roles(UserRole.CANDIDATE, UserRole.RECRUITER, UserRole.ORG_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate certificate for a result' })
  @ApiParam({ name: 'resultId', description: 'Result ID' })
  @ApiResponse({ status: 201, description: 'Certificate generated successfully' })
  @ApiResponse({ status: 404, description: 'Result not found' })
  @ApiResponse({ status: 400, description: 'Candidate did not pass' })
  async generateCertificate(@Param('resultId') resultId: string) {
    const certificateUrl = await this.certificateService.generateCertificate(resultId);

    return {
      message: 'Certificate generated successfully',
      certificateUrl,
    };
  }

  @Post('exam/:examId/generate-all')
  @Roles(UserRole.RECRUITER, UserRole.ORG_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate certificates for all passed candidates in an exam' })
  @ApiParam({ name: 'examId', description: 'Exam ID' })
  @ApiResponse({
    status: 201,
    description: 'Certificates generated successfully',
  })
  async generateCertificatesForExam(@Param('examId') examId: string) {
    const stats = await this.certificateService.generateCertificatesForExam(examId);

    return {
      message: 'Certificate generation completed',
      stats,
    };
  }

  @Get('result/:resultId')
  @Roles(UserRole.CANDIDATE, UserRole.RECRUITER, UserRole.ORG_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get certificate URL for a result' })
  @ApiParam({ name: 'resultId', description: 'Result ID' })
  @ApiResponse({ status: 200, description: 'Certificate URL retrieved' })
  async getCertificate(@Param('resultId') resultId: string) {
    const certificateUrl = await this.certificateService.getCertificateUrl(resultId);

    return {
      certificateUrl,
    };
  }

  @Get('download/:filename')
  @ApiOperation({ summary: 'Download certificate PDF' })
  @ApiParam({ name: 'filename', description: 'Certificate filename' })
  @ApiResponse({ status: 200, description: 'Certificate PDF' })
  async downloadCertificate(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const filepath = path.join(process.cwd(), 'certificates', filename);

    // Check if file exists
    if (!fs.existsSync(filepath)) {
      throw new NotFoundException('Certificate not found');
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream the file
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);
  }
}
