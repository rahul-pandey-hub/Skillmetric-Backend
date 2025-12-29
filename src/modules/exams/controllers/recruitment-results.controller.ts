import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  NotFoundException,
  ForbiddenException,
  StreamableFile,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/schemas/user.schema';
import { Exam } from '../schemas/exam.schema';
import { ExamInvitation, InvitationStatus } from '../schemas/exam-invitation.schema';
import { Result } from '../../results/schemas/result.schema';
import { createObjectCsvStringifier } from 'csv-writer';

interface ShortlistDto {
  invitationIds: string[];
  action: 'shortlist' | 'reject';
  comments?: string;
}

@ApiTags('recruitment-results')
@Controller('exams/:examId/recruitment-results')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RecruitmentResultsController {
  constructor(
    @InjectModel(Exam.name) private readonly examModel: Model<Exam>,
    @InjectModel(ExamInvitation.name)
    private readonly invitationModel: Model<ExamInvitation>,
    @InjectModel(Result.name) private readonly resultModel: Model<Result>,
  ) {}

  /**
   * GET /exams/:examId/recruitment-results
   * Get all recruitment results for an exam
   * Accessible by ORG_ADMIN and RECRUITER
   */
  @Get()
  @Roles(UserRole.ORG_ADMIN, UserRole.RECRUITER)
  @ApiOperation({
    summary: 'Get recruitment exam results',
    description: 'Get all invitation-based results for a recruitment exam',
  })
  @ApiParam({ name: 'examId', description: 'Exam ID' })
  @ApiQuery({ name: 'status', required: false, enum: ['all', 'completed', 'pending', 'expired'] })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['score', 'submittedAt', 'name'] })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name or email' })
  @ApiResponse({ status: 200, description: 'Recruitment results retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have access' })
  async getRecruitmentResults(
    @Param('examId') examId: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy: string = 'submittedAt',
    @Query('search') search?: string,
    @Request() req?,
  ) {
    // Verify exam exists and user has access
    const exam = await this.verifyExamAccess(examId, req.user.id, req.user.role);

    // Build filter for invitations
    const invitationFilter: any = { examId: exam._id };

    if (status && status !== 'all') {
      if (status === 'completed') {
        invitationFilter.status = InvitationStatus.COMPLETED;
      } else if (status === 'pending') {
        invitationFilter.status = {
          $in: [InvitationStatus.PENDING, InvitationStatus.ACCESSED, InvitationStatus.STARTED],
        };
      } else if (status === 'expired') {
        invitationFilter.status = InvitationStatus.EXPIRED;
      }
    }

    // Add search filter
    if (search) {
      invitationFilter.$or = [
        { candidateName: { $regex: search, $options: 'i' } },
        { candidateEmail: { $regex: search, $options: 'i' } },
      ];
    }

    // Get all invitations
    const invitations = await this.invitationModel
      .find(invitationFilter)
      .populate('resultId')
      .sort({ createdAt: -1 })
      .exec();

    // Get all results for completed invitations
    const resultIds = invitations
      .filter((inv) => inv.resultId)
      .map((inv) => inv.resultId);

    const results = await this.resultModel
      .find({ _id: { $in: resultIds } })
      .exec();

    // Create a map of resultId to result
    const resultMap = new Map();
    results.forEach((result) => {
      resultMap.set(result._id.toString(), result);
    });

    // Calculate ranks for completed results
    const completedResults = results.filter((r) => r.scoring);
    completedResults.sort((a, b) => b.scoring.totalScore - a.scoring.totalScore);

    const rankMap = new Map();
    completedResults.forEach((result, index) => {
      rankMap.set(result._id.toString(), index + 1);
    });

    // Transform invitations to result format
    const data = invitations.map((invitation) => {
      const result = invitation.resultId
        ? resultMap.get(invitation.resultId.toString())
        : null;

      return {
        invitationId: invitation._id,
        candidateName: invitation.candidateName,
        candidateEmail: invitation.candidateEmail,
        candidatePhone: invitation.candidatePhone,
        status: invitation.status,
        invitedAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
        firstAccessedAt: invitation.firstAccessedAt,
        examStartedAt: invitation.examStartedAt,
        examCompletedAt: invitation.examCompletedAt,
        score: result?.scoring?.totalScore || null,
        percentage: result?.scoring?.percentage || null,
        rank: result ? rankMap.get(result._id.toString()) : null,
        outOf: completedResults.length,
        submittedAt: result?.submittedAt || null,
        shortlisted: result?.shortlistingDecision?.isShortlisted || false,
        shortlistingComments: result?.shortlistingDecision?.comments || null,
      };
    });

    // Sort data
    if (sortBy === 'score') {
      data.sort((a, b) => (b.score || 0) - (a.score || 0));
    } else if (sortBy === 'name') {
      data.sort((a, b) => a.candidateName.localeCompare(b.candidateName));
    } else {
      // Default: submittedAt (already sorted by createdAt)
    }

    // Calculate statistics
    const stats = {
      totalInvited: invitations.length,
      completed: invitations.filter((inv) => inv.status === InvitationStatus.COMPLETED).length,
      pending: invitations.filter((inv) =>
        [InvitationStatus.PENDING, InvitationStatus.ACCESSED, InvitationStatus.STARTED].includes(inv.status)
      ).length,
      expired: invitations.filter((inv) => inv.status === InvitationStatus.EXPIRED).length,
      averageScore:
        completedResults.length > 0
          ? completedResults.reduce((sum, r) => sum + r.scoring.totalScore, 0) / completedResults.length
          : 0,
      shortlisted: results.filter((r) => r.shortlistingDecision?.isShortlisted).length,
    };

    return {
      data,
      total: data.length,
      stats,
    };
  }

  /**
   * POST /exams/:examId/recruitment-results/shortlist
   * Shortlist or reject candidates in bulk
   */
  @Post('shortlist')
  @Roles(UserRole.ORG_ADMIN, UserRole.RECRUITER)
  @ApiOperation({
    summary: 'Shortlist or reject recruitment candidates',
    description: 'Update shortlisting decision for multiple candidates',
  })
  @ApiParam({ name: 'examId', description: 'Exam ID' })
  @ApiResponse({ status: 200, description: 'Shortlisting decisions updated' })
  async shortlistCandidates(
    @Param('examId') examId: string,
    @Body() shortlistDto: ShortlistDto,
    @Request() req,
  ) {
    const { invitationIds, action, comments } = shortlistDto;

    // Verify exam access
    const exam = await this.verifyExamAccess(examId, req.user.id, req.user.role);

    // Get invitations
    const invitations = await this.invitationModel
      .find({
        _id: { $in: invitationIds },
        examId: exam._id,
      })
      .exec();

    if (invitations.length === 0) {
      throw new NotFoundException('No invitations found');
    }

    // Get results for these invitations
    const resultIds = invitations
      .filter((inv) => inv.resultId)
      .map((inv) => inv.resultId);

    const isShortlisted = action === 'shortlist';
    const updateData: any = {
      'shortlistingDecision.isShortlisted': isShortlisted,
      'shortlistingDecision.comments': comments,
    };

    if (isShortlisted) {
      updateData['shortlistingDecision.shortlistedAt'] = new Date();
      updateData['shortlistingDecision.shortlistedBy'] = req.user.id;
      updateData['shortlistingDecision.rejectedAt'] = null;
      updateData['shortlistingDecision.rejectedBy'] = null;
    } else {
      updateData['shortlistingDecision.rejectedAt'] = new Date();
      updateData['shortlistingDecision.rejectedBy'] = req.user.id;
      updateData['shortlistingDecision.shortlistedAt'] = null;
      updateData['shortlistingDecision.shortlistedBy'] = null;
    }

    const updateResult = await this.resultModel.updateMany(
      { _id: { $in: resultIds } },
      { $set: updateData }
    );

    return {
      success: true,
      message: `${updateResult.modifiedCount} candidate(s) ${action === 'shortlist' ? 'shortlisted' : 'rejected'}`,
      updated: updateResult.modifiedCount,
    };
  }

  /**
   * GET /exams/:examId/recruitment-results/export
   * Export recruitment results as CSV
   */
  @Get('export')
  @Roles(UserRole.ORG_ADMIN, UserRole.RECRUITER)
  @ApiOperation({
    summary: 'Export recruitment results',
    description: 'Download recruitment exam results as CSV',
  })
  @ApiParam({ name: 'examId', description: 'Exam ID' })
  @ApiQuery({ name: 'format', required: false, enum: ['csv'] })
  @ApiResponse({ status: 200, description: 'File download' })
  async exportRecruitmentResults(
    @Param('examId') examId: string,
    @Query('format') format: string = 'csv',
    @Request() req,
  ) {
    // Verify exam access
    const exam = await this.verifyExamAccess(examId, req.user.id, req.user.role);

    // Get all invitations and results
    const invitations = await this.invitationModel
      .find({ examId: exam._id })
      .populate('resultId')
      .exec();

    const resultIds = invitations
      .filter((inv) => inv.resultId)
      .map((inv) => inv.resultId);

    const results = await this.resultModel.find({ _id: { $in: resultIds } }).exec();

    const resultMap = new Map();
    results.forEach((result) => {
      resultMap.set(result._id.toString(), result);
    });

    // Calculate ranks
    const completedResults = results.filter((r) => r.scoring);
    completedResults.sort((a, b) => b.scoring.totalScore - a.scoring.totalScore);

    const rankMap = new Map();
    completedResults.forEach((result, index) => {
      rankMap.set(result._id.toString(), index + 1);
    });

    // Prepare CSV data
    const csvData = invitations.map((invitation) => {
      const result = invitation.resultId
        ? resultMap.get(invitation.resultId.toString())
        : null;

      return {
        name: invitation.candidateName,
        email: invitation.candidateEmail,
        phone: invitation.candidatePhone || '',
        status: invitation.status,
        invitedAt: invitation.createdAt.toISOString(),
        expiresAt: invitation.expiresAt.toISOString(),
        startedAt: invitation.examStartedAt?.toISOString() || '',
        completedAt: invitation.examCompletedAt?.toISOString() || '',
        score: result?.scoring?.totalScore || '',
        percentage: result?.scoring?.percentage || '',
        rank: result ? rankMap.get(result._id.toString()) : '',
        outOf: completedResults.length,
        shortlisted: result?.shortlistingDecision?.isShortlisted ? 'Yes' : 'No',
        shortlistingComments: result?.shortlistingDecision?.comments || '',
      };
    });

    if (format === 'csv') {
      const csvStringifier = createObjectCsvStringifier({
        header: [
          { id: 'name', title: 'Name' },
          { id: 'email', title: 'Email' },
          { id: 'phone', title: 'Phone' },
          { id: 'status', title: 'Status' },
          { id: 'invitedAt', title: 'Invited At' },
          { id: 'expiresAt', title: 'Expires At' },
          { id: 'startedAt', title: 'Started At' },
          { id: 'completedAt', title: 'Completed At' },
          { id: 'score', title: 'Score' },
          { id: 'percentage', title: 'Percentage' },
          { id: 'rank', title: 'Rank' },
          { id: 'outOf', title: 'Out Of' },
          { id: 'shortlisted', title: 'Shortlisted' },
          { id: 'shortlistingComments', title: 'Comments' },
        ],
      });

      const csvContent =
        csvStringifier.getHeaderString() +
        csvStringifier.stringifyRecords(csvData);

      const buffer = Buffer.from(csvContent, 'utf-8');

      return new StreamableFile(buffer, {
        type: 'text/csv',
        disposition: `attachment; filename="recruitment-results-${exam.code}-${Date.now()}.csv"`,
      });
    }

    throw new NotFoundException('Unsupported export format');
  }

  /**
   * Verify user has access to exam
   */
  private async verifyExamAccess(
    examId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<any> {
    const exam = await this.examModel.findById(examId).exec();

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    // ORG_ADMIN: must be in same organization
    if (userRole === UserRole.ORG_ADMIN) {
      // Check if user's organization matches exam's organization
      // For now, just allow (would need to check user.organizationIds)
      return exam;
    }

    // RECRUITER: must be exam creator or same organization
    if (userRole === UserRole.RECRUITER) {
      if (exam.createdBy.toString() !== userId) {
        // Could add organization check here
        throw new ForbiddenException(
          'You can only view results for exams you created'
        );
      }
      return exam;
    }

    throw new ForbiddenException('Insufficient permissions');
  }
}
