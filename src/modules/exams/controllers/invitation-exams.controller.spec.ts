import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as request from 'supertest';
import { Exam } from '../schemas/exam.schema';
import { ExamInvitation, InvitationStatus } from '../schemas/exam-invitation.schema';
import { ExamSession } from '../../proctoring/schemas/exam-session.schema';
import { Result } from '../../results/schemas/result.schema';
import { User, UserRole } from '../../users/schemas/user.schema';
import { Organization } from '../../organizations/schemas/organization.schema';
import { ExamsModule } from '../exams.module';
import { AuthModule } from '../../auth/auth.module';
import { EmailModule } from '../../email/email.module';
import { ExamCategory, ExamAccessMode } from '../schemas/exam.schema';

describe('Invitation Flow Integration Tests', () => {
  let app: INestApplication;
  let examModel: Model<Exam>;
  let invitationModel: Model<ExamInvitation>;
  let sessionModel: Model<ExamSession>;
  let resultModel: Model<Result>;
  let userModel: Model<User>;
  let orgModel: Model<Organization>;

  // Test data
  let testOrganization: Organization;
  let testOrgAdmin: User;
  let testRecruiter: User;
  let testExam: Exam;
  let testInvitation: ExamInvitation;
  let authToken: string;
  let recruiterToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ExamsModule, AuthModule, EmailModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    examModel = moduleFixture.get<Model<Exam>>(getModelToken(Exam.name));
    invitationModel = moduleFixture.get<Model<ExamInvitation>>(
      getModelToken(ExamInvitation.name),
    );
    sessionModel = moduleFixture.get<Model<ExamSession>>(
      getModelToken(ExamSession.name),
    );
    resultModel = moduleFixture.get<Model<Result>>(
      getModelToken(Result.name),
    );
    userModel = moduleFixture.get<Model<User>>(getModelToken(User.name));
    orgModel = moduleFixture.get<Model<Organization>>(
      getModelToken(Organization.name),
    );
  });

  beforeEach(async () => {
    // Create test organization
    testOrganization = await orgModel.create({
      name: 'Test Organization',
      domain: 'test.com',
      contactEmail: 'admin@test.com',
      isActive: true,
    });

    // Create org admin user
    testOrgAdmin = await userModel.create({
      name: 'Org Admin',
      email: 'orgadmin@test.com',
      password: 'hashedPassword123',
      role: UserRole.ORG_ADMIN,
      organizationId: testOrganization._id,
      isActive: true,
    });

    // Create recruiter user
    testRecruiter = await userModel.create({
      name: 'Recruiter',
      email: 'recruiter@test.com',
      password: 'hashedPassword123',
      role: UserRole.RECRUITER,
      organizationId: testOrganization._id,
      isActive: true,
    });

    // Create recruitment exam
    testExam = await examModel.create({
      title: 'JavaScript Developer Assessment',
      description: 'Technical assessment for JavaScript developers',
      duration: 60,
      totalMarks: 100,
      passingMarks: 60,
      category: ExamCategory.RECRUITMENT,
      accessMode: ExamAccessMode.INVITATION_BASED,
      organizationId: testOrganization._id,
      createdBy: testOrgAdmin._id,
      invitationSettings: {
        linkValidityDays: 7,
        allowMultipleAccess: true,
        maxAccessCount: 10,
        autoExpireOnSubmit: true,
        sendReminderEmails: true,
        reminderBeforeDays: 1,
      },
      recruitmentResultSettings: {
        showScoreToCandidate: false,
        showRankToCandidate: false,
        showOnlyConfirmation: true,
        candidateResultMessage: 'Thank you for completing the assessment.',
        recruiterCanExport: true,
      },
      questions: [],
      isActive: true,
      isPublished: true,
    });

    // Generate auth tokens (mock JWT generation)
    authToken = 'mock-org-admin-jwt-token';
    recruiterToken = 'mock-recruiter-jwt-token';
  });

  afterEach(async () => {
    await invitationModel.deleteMany({});
    await examModel.deleteMany({});
    await sessionModel.deleteMany({});
    await resultModel.deleteMany({});
    await userModel.deleteMany({});
    await orgModel.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/exams/:examId/invitations - Send Invitations', () => {
    it('should send invitations to multiple candidates', async () => {
      const candidates = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '+0987654321',
        },
      ];

      const response = await request(app.getHttpServer())
        .post(`/api/exams/${testExam._id}/invitations`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          candidates,
          invitationNote: 'Please complete this assessment by next week.',
          validityDays: 7,
        })
        .expect(201);

      expect(response.body.summary.sent).toBe(2);
      expect(response.body.summary.failed).toBe(0);
      expect(response.body.details).toHaveLength(2);

      // Verify invitations created in database
      const invitations = await invitationModel.find({
        examId: testExam._id,
      });
      expect(invitations).toHaveLength(2);

      // Verify invitation properties
      const johnInvitation = invitations.find(
        (inv) => inv.candidateEmail === 'john@example.com',
      );
      expect(johnInvitation).toBeDefined();
      expect(johnInvitation?.candidateName).toBe('John Doe');
      expect(johnInvitation?.status).toBe(InvitationStatus.PENDING);
      expect(johnInvitation?.invitationToken).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(johnInvitation?.accessCount).toBe(0);
    });

    it('should prevent duplicate invitations for same email', async () => {
      // Create existing invitation
      await invitationModel.create({
        invitationToken: 'existing-token',
        examId: testExam._id,
        organizationId: testOrganization._id,
        candidateEmail: 'john@example.com',
        candidateName: 'John Doe',
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        accessCount: 0,
        invitedBy: testOrgAdmin._id,
      });

      const response = await request(app.getHttpServer())
        .post(`/api/exams/${testExam._id}/invitations`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          candidates: [
            { name: 'John Doe', email: 'john@example.com' },
            { name: 'Jane Smith', email: 'jane@example.com' },
          ],
          validityDays: 7,
        })
        .expect(201);

      expect(response.body.summary.sent).toBe(1); // Only Jane
      expect(response.body.summary.duplicate).toBe(1); // John
    });

    it('should validate email format', async () => {
      await request(app.getHttpServer())
        .post(`/api/exams/${testExam._id}/invitations`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          candidates: [{ name: 'Invalid Email', email: 'not-an-email' }],
          validityDays: 7,
        })
        .expect(400);
    });

    it('should only allow ORG_ADMIN and RECRUITER to send invitations', async () => {
      // Test without auth
      await request(app.getHttpServer())
        .post(`/api/exams/${testExam._id}/invitations`)
        .send({
          candidates: [{ name: 'John', email: 'john@example.com' }],
          validityDays: 7,
        })
        .expect(401);
    });

    it('should reject invitations for non-invitation-based exams', async () => {
      // Create enrollment-based exam
      const enrollmentExam = await examModel.create({
        ...testExam.toObject(),
        _id: new Types.ObjectId(),
        accessMode: ExamAccessMode.ENROLLMENT_BASED,
      });

      await request(app.getHttpServer())
        .post(`/api/exams/${enrollmentExam._id}/invitations`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          candidates: [{ name: 'John', email: 'john@example.com' }],
          validityDays: 7,
        })
        .expect(400);
    });
  });

  describe('GET /api/exams/invitation/:token - Access Invitation', () => {
    beforeEach(async () => {
      testInvitation = await invitationModel.create({
        invitationToken: 'test-token-123',
        examId: testExam._id,
        organizationId: testOrganization._id,
        candidateEmail: 'candidate@example.com',
        candidateName: 'Test Candidate',
        candidatePhone: '+1234567890',
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        accessCount: 0,
        invitedBy: testOrgAdmin._id,
      });
    });

    it('should return invitation details for valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/exams/invitation/test-token-123')
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.exam.title).toBe('JavaScript Developer Assessment');
      expect(response.body.candidate.name).toBe('Test Candidate');
      expect(response.body.candidate.email).toBe('candidate@example.com');
      expect(response.body.status).toBe(InvitationStatus.PENDING);
      expect(response.body.canStart).toBe(true);
    });

    it('should increment access count on each access', async () => {
      await request(app.getHttpServer())
        .get('/api/exams/invitation/test-token-123')
        .expect(200);

      const invitation = await invitationModel.findOne({
        invitationToken: 'test-token-123',
      });
      expect(invitation?.accessCount).toBe(1);
      expect(invitation?.status).toBe(InvitationStatus.ACCESSED);
      expect(invitation?.firstAccessedAt).toBeDefined();
    });

    it('should reject expired invitations', async () => {
      await invitationModel.updateOne(
        { invitationToken: 'test-token-123' },
        { expiresAt: new Date(Date.now() - 1000) },
      );

      await request(app.getHttpServer())
        .get('/api/exams/invitation/test-token-123')
        .expect(400);
    });

    it('should reject revoked invitations', async () => {
      await invitationModel.updateOne(
        { invitationToken: 'test-token-123' },
        { status: InvitationStatus.REVOKED },
      );

      await request(app.getHttpServer())
        .get('/api/exams/invitation/test-token-123')
        .expect(400);
    });

    it('should reject completed invitations', async () => {
      await invitationModel.updateOne(
        { invitationToken: 'test-token-123' },
        { status: InvitationStatus.COMPLETED },
      );

      const response = await request(app.getHttpServer())
        .get('/api/exams/invitation/test-token-123')
        .expect(200);

      expect(response.body.canStart).toBe(false);
      expect(response.body.message).toContain('already been used');
    });

    it('should return 404 for non-existent token', async () => {
      await request(app.getHttpServer())
        .get('/api/exams/invitation/non-existent-token')
        .expect(404);
    });
  });

  describe('POST /api/exams/invitation/:token/start - Start Exam', () => {
    beforeEach(async () => {
      testInvitation = await invitationModel.create({
        invitationToken: 'test-token-123',
        examId: testExam._id,
        organizationId: testOrganization._id,
        candidateEmail: 'candidate@example.com',
        candidateName: 'Test Candidate',
        status: InvitationStatus.ACCESSED,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        accessCount: 1,
        invitedBy: testOrgAdmin._id,
        firstAccessedAt: new Date(),
      });
    });

    it('should start exam and return temporary token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/exams/invitation/test-token-123/start')
        .expect(201);

      expect(response.body.temporaryToken).toBeDefined();
      expect(response.body.sessionId).toBeDefined();
      expect(response.body.exam).toBeDefined();
      expect(response.body.questions).toBeDefined();
      expect(response.body.expiresAt).toBeDefined();

      // Verify session created
      const session = await sessionModel.findById(response.body.sessionId);
      expect(session).toBeDefined();
      expect(session?.invitationId?.toString()).toBe(
        testInvitation._id.toString(),
      );
      expect(session?.accessSource).toBe('INVITATION');
      expect(session?.guestCandidateInfo?.email).toBe('candidate@example.com');

      // Verify invitation status updated
      const invitation = await invitationModel.findById(testInvitation._id);
      expect(invitation?.status).toBe(InvitationStatus.STARTED);
      expect(invitation?.sessionId).toBeDefined();
      expect(invitation?.examStartedAt).toBeDefined();
    });

    it('should not allow starting expired invitation', async () => {
      await invitationModel.updateOne(
        { _id: testInvitation._id },
        { expiresAt: new Date(Date.now() - 1000) },
      );

      await request(app.getHttpServer())
        .post('/api/exams/invitation/test-token-123/start')
        .expect(400);
    });

    it('should not allow starting completed invitation', async () => {
      await invitationModel.updateOne(
        { _id: testInvitation._id },
        { status: InvitationStatus.COMPLETED },
      );

      await request(app.getHttpServer())
        .post('/api/exams/invitation/test-token-123/start')
        .expect(400);
    });

    it('should allow multiple starts if allowMultipleAccess is true', async () => {
      // Start first time
      const response1 = await request(app.getHttpServer())
        .post('/api/exams/invitation/test-token-123/start')
        .expect(201);

      // Delete session to simulate abandoned attempt
      await sessionModel.deleteOne({ _id: response1.body.sessionId });

      // Reset invitation status
      await invitationModel.updateOne(
        { _id: testInvitation._id },
        { status: InvitationStatus.ACCESSED },
      );

      // Start second time
      const response2 = await request(app.getHttpServer())
        .post('/api/exams/invitation/test-token-123/start')
        .expect(201);

      expect(response2.body.sessionId).not.toBe(response1.body.sessionId);
    });
  });

  describe('POST /api/student/exams/:examId/submit - Submit Exam (Invitation)', () => {
    let testSession: ExamSession;
    let temporaryToken: string;

    beforeEach(async () => {
      testInvitation = await invitationModel.create({
        invitationToken: 'test-token-123',
        examId: testExam._id,
        organizationId: testOrganization._id,
        candidateEmail: 'candidate@example.com',
        candidateName: 'Test Candidate',
        status: InvitationStatus.STARTED,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        accessCount: 1,
        invitedBy: testOrgAdmin._id,
        examStartedAt: new Date(),
      });

      testSession = await sessionModel.create({
        examId: testExam._id,
        invitationId: testInvitation._id,
        accessSource: 'INVITATION',
        guestCandidateInfo: {
          email: 'candidate@example.com',
          name: 'Test Candidate',
          phone: '+1234567890',
        },
        startTime: new Date(),
        status: 'ACTIVE',
      });

      // Mock temporary JWT token
      temporaryToken = 'mock-temporary-jwt-token';
    });

    it('should submit exam and create result for invitation-based access', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/student/exams/${testExam._id}/submit`)
        .set('Authorization', `Bearer ${temporaryToken}`)
        .send({
          sessionId: testSession._id.toString(),
          answers: [
            { questionId: 'q1', answer: 'A' },
            { questionId: 'q2', answer: 'B' },
          ],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.resultId).toBeDefined();

      // Verify result created
      const result = await resultModel.findById(response.body.resultId);
      expect(result).toBeDefined();
      expect(result?.invitationId?.toString()).toBe(
        testInvitation._id.toString(),
      );
      expect(result?.student).toBeUndefined();
      expect(result?.isRecruitmentExam).toBe(true);
      expect(result?.guestCandidateInfo?.email).toBe('candidate@example.com');

      // Verify invitation status updated to COMPLETED
      const invitation = await invitationModel.findById(testInvitation._id);
      expect(invitation?.status).toBe(InvitationStatus.COMPLETED);
      expect(invitation?.resultId).toBeDefined();
      expect(invitation?.examCompletedAt).toBeDefined();

      // Verify session closed
      const session = await sessionModel.findById(testSession._id);
      expect(session?.status).toBe('COMPLETED');
      expect(session?.endTime).toBeDefined();
    });

    it('should auto-expire invitation if autoExpireOnSubmit is true', async () => {
      await request(app.getHttpServer())
        .post(`/api/student/exams/${testExam._id}/submit`)
        .set('Authorization', `Bearer ${temporaryToken}`)
        .send({
          sessionId: testSession._id.toString(),
          answers: [],
        })
        .expect(201);

      const invitation = await invitationModel.findById(testInvitation._id);
      expect(invitation?.status).toBe(InvitationStatus.COMPLETED);
    });

    it('should respect result visibility settings for recruitment exams', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/student/exams/${testExam._id}/submit`)
        .set('Authorization', `Bearer ${temporaryToken}`)
        .send({
          sessionId: testSession._id.toString(),
          answers: [],
        })
        .expect(201);

      const result = await resultModel.findById(response.body.resultId);

      // Should not show score/rank based on recruitmentResultSettings
      expect(result?.visibleToCandidate).toBe(false);
    });
  });

  describe('GET /api/exams/:examId/recruitment-results - View Results', () => {
    beforeEach(async () => {
      // Create multiple invitations with different statuses
      const invitation1 = await invitationModel.create({
        invitationToken: 'token-1',
        examId: testExam._id,
        organizationId: testOrganization._id,
        candidateEmail: 'john@example.com',
        candidateName: 'John Doe',
        status: InvitationStatus.COMPLETED,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        accessCount: 1,
        invitedBy: testOrgAdmin._id,
        examCompletedAt: new Date(),
      });

      const invitation2 = await invitationModel.create({
        invitationToken: 'token-2',
        examId: testExam._id,
        organizationId: testOrganization._id,
        candidateEmail: 'jane@example.com',
        candidateName: 'Jane Smith',
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        accessCount: 0,
        invitedBy: testOrgAdmin._id,
      });

      // Create result for completed invitation
      await resultModel.create({
        exam: testExam._id,
        invitationId: invitation1._id,
        guestCandidateInfo: {
          email: 'john@example.com',
          name: 'John Doe',
        },
        totalMarks: 100,
        obtainedMarks: 85,
        percentage: 85,
        isPassed: true,
        isRecruitmentExam: true,
        submittedAt: new Date(),
      });
    });

    it('should return recruitment results for ORG_ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/exams/${testExam._id}/recruitment-results`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.stats.totalInvited).toBe(2);
      expect(response.body.stats.completed).toBe(1);
      expect(response.body.stats.pending).toBe(1);
    });

    it('should return recruitment results for RECRUITER', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/exams/${testExam._id}/recruitment-results`)
        .set('Authorization', `Bearer ${recruiterToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
    });

    it('should filter results by status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/exams/${testExam._id}/recruitment-results`)
        .query({ status: InvitationStatus.COMPLETED })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe(InvitationStatus.COMPLETED);
    });

    it('should sort results by score', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/exams/${testExam._id}/recruitment-results`)
        .query({ sortBy: 'score' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data[0].score).toBeDefined();
    });

    it('should not allow CANDIDATE role to access recruitment results', async () => {
      await request(app.getHttpServer())
        .get(`/api/exams/${testExam._id}/recruitment-results`)
        .set('Authorization', 'Bearer mock-candidate-token')
        .expect(403);
    });
  });

  describe('POST /api/exams/:examId/recruitment-results/shortlist - Shortlist Candidates', () => {
    let invitation1: ExamInvitation;
    let invitation2: ExamInvitation;

    beforeEach(async () => {
      invitation1 = await invitationModel.create({
        invitationToken: 'token-1',
        examId: testExam._id,
        organizationId: testOrganization._id,
        candidateEmail: 'john@example.com',
        candidateName: 'John Doe',
        status: InvitationStatus.COMPLETED,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        accessCount: 1,
        invitedBy: testOrgAdmin._id,
      });

      invitation2 = await invitationModel.create({
        invitationToken: 'token-2',
        examId: testExam._id,
        organizationId: testOrganization._id,
        candidateEmail: 'jane@example.com',
        candidateName: 'Jane Smith',
        status: InvitationStatus.COMPLETED,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        accessCount: 1,
        invitedBy: testOrgAdmin._id,
      });

      // Create results
      await resultModel.create({
        exam: testExam._id,
        invitationId: invitation1._id,
        guestCandidateInfo: { email: 'john@example.com', name: 'John Doe' },
        obtainedMarks: 85,
        isRecruitmentExam: true,
      });

      await resultModel.create({
        exam: testExam._id,
        invitationId: invitation2._id,
        guestCandidateInfo: { email: 'jane@example.com', name: 'Jane Smith' },
        obtainedMarks: 75,
        isRecruitmentExam: true,
      });
    });

    it('should shortlist selected candidates', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/exams/${testExam._id}/recruitment-results/shortlist`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          invitationIds: [invitation1._id.toString()],
          action: 'shortlist',
          comments: 'Strong performance',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.updated).toBe(1);

      // Verify result updated
      const result = await resultModel.findOne({ invitationId: invitation1._id });
      expect(result?.shortlistingDecision?.isShortlisted).toBe(true);
      expect(result?.shortlistingDecision?.comments).toBe('Strong performance');
      expect(result?.shortlistingDecision?.shortlistedAt).toBeDefined();
    });

    it('should reject selected candidates', async () => {
      await request(app.getHttpServer())
        .post(`/api/exams/${testExam._id}/recruitment-results/shortlist`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          invitationIds: [invitation2._id.toString()],
          action: 'reject',
        })
        .expect(200);

      const result = await resultModel.findOne({ invitationId: invitation2._id });
      expect(result?.shortlistingDecision?.isShortlisted).toBe(false);
      expect(result?.shortlistingDecision?.rejectedAt).toBeDefined();
    });

    it('should allow RECRUITER to shortlist candidates', async () => {
      await request(app.getHttpServer())
        .post(`/api/exams/${testExam._id}/recruitment-results/shortlist`)
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({
          invitationIds: [invitation1._id.toString()],
          action: 'shortlist',
        })
        .expect(200);
    });
  });

  describe('GET /api/exams/:examId/recruitment-results/export - Export Results', () => {
    beforeEach(async () => {
      const invitation = await invitationModel.create({
        invitationToken: 'token-1',
        examId: testExam._id,
        organizationId: testOrganization._id,
        candidateEmail: 'john@example.com',
        candidateName: 'John Doe',
        status: InvitationStatus.COMPLETED,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        accessCount: 1,
        invitedBy: testOrgAdmin._id,
      });

      await resultModel.create({
        exam: testExam._id,
        invitationId: invitation._id,
        guestCandidateInfo: { email: 'john@example.com', name: 'John Doe' },
        obtainedMarks: 85,
        totalMarks: 100,
        percentage: 85,
        isRecruitmentExam: true,
      });
    });

    it('should export results as CSV', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/exams/${testExam._id}/recruitment-results/export`)
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.text).toContain('John Doe');
      expect(response.text).toContain('john@example.com');
    });

    it('should allow RECRUITER to export if recruiterCanExport is true', async () => {
      await request(app.getHttpServer())
        .get(`/api/exams/${testExam._id}/recruitment-results/export`)
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${recruiterToken}`)
        .expect(200);
    });

    it('should block RECRUITER export if recruiterCanExport is false', async () => {
      await examModel.updateOne(
        { _id: testExam._id },
        { 'recruitmentResultSettings.recruiterCanExport': false },
      );

      await request(app.getHttpServer())
        .get(`/api/exams/${testExam._id}/recruitment-results/export`)
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${recruiterToken}`)
        .expect(403);
    });
  });

  describe('Complete Invitation Lifecycle', () => {
    it('should complete full invitation flow: send → access → start → submit → results', async () => {
      // Step 1: Send invitation
      const sendResponse = await request(app.getHttpServer())
        .post(`/api/exams/${testExam._id}/invitations`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          candidates: [{ name: 'Alice Johnson', email: 'alice@example.com' }],
          validityDays: 7,
        })
        .expect(201);

      const token = sendResponse.body.details[0].invitationToken;

      // Step 2: Access invitation
      const accessResponse = await request(app.getHttpServer())
        .get(`/api/exams/invitation/${token}`)
        .expect(200);

      expect(accessResponse.body.valid).toBe(true);

      // Step 3: Start exam
      const startResponse = await request(app.getHttpServer())
        .post(`/api/exams/invitation/${token}/start`)
        .expect(201);

      const sessionId = startResponse.body.sessionId;
      const tempToken = startResponse.body.temporaryToken;

      // Step 4: Submit exam
      const submitResponse = await request(app.getHttpServer())
        .post(`/api/student/exams/${testExam._id}/submit`)
        .set('Authorization', `Bearer ${tempToken}`)
        .send({
          sessionId,
          answers: [],
        })
        .expect(201);

      expect(submitResponse.body.success).toBe(true);

      // Step 5: View recruitment results
      const resultsResponse = await request(app.getHttpServer())
        .get(`/api/exams/${testExam._id}/recruitment-results`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(resultsResponse.body.data).toHaveLength(1);
      expect(resultsResponse.body.data[0].candidateEmail).toBe(
        'alice@example.com',
      );
      expect(resultsResponse.body.data[0].status).toBe(
        InvitationStatus.COMPLETED,
      );

      // Verify database state
      const invitation = await invitationModel.findOne({
        invitationToken: token,
      });
      expect(invitation?.status).toBe(InvitationStatus.COMPLETED);
      expect(invitation?.sessionId).toBeDefined();
      expect(invitation?.resultId).toBeDefined();

      const result = await resultModel.findById(invitation?.resultId);
      expect(result?.invitationId?.toString()).toBe(
        invitation?._id.toString(),
      );
      expect(result?.isRecruitmentExam).toBe(true);
    });
  });
});
