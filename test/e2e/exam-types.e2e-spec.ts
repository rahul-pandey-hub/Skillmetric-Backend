import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import * as request from 'supertest';
import { Model, Types } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { User, UserRole } from '../../src/modules/users/schemas/user.schema';
import { Organization } from '../../src/modules/organizations/schemas/organization.schema';
import { Exam, ExamCategory, ExamAccessMode } from '../../src/modules/exams/schemas/exam.schema';
import { ExamInvitation } from '../../src/modules/exams/schemas/exam-invitation.schema';
import { Result } from '../../src/modules/results/schemas/result.schema';

describe('Multi-Exam Type E2E Tests', () => {
  let app: INestApplication;
  let userModel: Model<User>;
  let orgModel: Model<Organization>;
  let examModel: Model<Exam>;
  let invitationModel: Model<ExamInvitation>;
  let resultModel: Model<Result>;

  // Test organizations
  let techCorpOrg: Organization;
  let consultingFirmOrg: Organization;

  // Test users
  let superAdmin: User;
  let techCorpOrgAdmin: User;
  let techCorpRecruiter: User;
  let techCorpEmployee: User;
  let externalCandidate: User;

  // Auth tokens
  let superAdminToken: string;
  let techCorpOrgAdminToken: string;
  let techCorpRecruiterToken: string;
  let techCorpEmployeeToken: string;
  let externalCandidateToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    userModel = moduleFixture.get<Model<User>>(getModelToken(User.name));
    orgModel = moduleFixture.get<Model<Organization>>(
      getModelToken(Organization.name),
    );
    examModel = moduleFixture.get<Model<Exam>>(getModelToken(Exam.name));
    invitationModel = moduleFixture.get<Model<ExamInvitation>>(
      getModelToken(ExamInvitation.name),
    );
    resultModel = moduleFixture.get<Model<Result>>(
      getModelToken(Result.name),
    );

    // Setup test data
    await setupTestData();
  });

  async function setupTestData() {
    // Create super admin
    superAdmin = await userModel.create({
      name: 'Super Admin',
      email: 'superadmin@skillmetric.com',
      password: '$2b$10$hashedPassword', // hashed "password123"
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    });

    // Create TechCorp organization
    techCorpOrg = await orgModel.create({
      name: 'TechCorp Inc.',
      domain: 'techcorp.com',
      contactEmail: 'admin@techcorp.com',
      isActive: true,
      createdBy: superAdmin._id,
    });

    // Create ConsultingFirm organization
    consultingFirmOrg = await orgModel.create({
      name: 'Consulting Firm',
      domain: 'consultingfirm.com',
      contactEmail: 'admin@consultingfirm.com',
      isActive: true,
      createdBy: superAdmin._id,
    });

    // Create TechCorp users
    techCorpOrgAdmin = await userModel.create({
      name: 'TechCorp Admin',
      email: 'admin@techcorp.com',
      password: '$2b$10$hashedPassword',
      role: UserRole.ORG_ADMIN,
      organizationId: techCorpOrg._id,
      isActive: true,
    });

    techCorpRecruiter = await userModel.create({
      name: 'TechCorp Recruiter',
      email: 'recruiter@techcorp.com',
      password: '$2b$10$hashedPassword',
      role: UserRole.RECRUITER,
      organizationId: techCorpOrg._id,
      isActive: true,
    });

    techCorpEmployee = await userModel.create({
      name: 'John Employee',
      email: 'john@techcorp.com',
      password: '$2b$10$hashedPassword',
      role: UserRole.CANDIDATE,
      candidateType: 'EMPLOYEE',
      organizationId: techCorpOrg._id,
      isActive: true,
    });

    externalCandidate = await userModel.create({
      name: 'Alice External',
      email: 'alice.external@gmail.com',
      password: '$2b$10$hashedPassword',
      role: UserRole.CANDIDATE,
      candidateType: 'EXTERNAL',
      organizationId: techCorpOrg._id, // Registered with TechCorp
      isActive: true,
    });

    // Generate auth tokens (mock implementation)
    superAdminToken = 'mock-super-admin-token';
    techCorpOrgAdminToken = 'mock-techcorp-admin-token';
    techCorpRecruiterToken = 'mock-techcorp-recruiter-token';
    techCorpEmployeeToken = 'mock-techcorp-employee-token';
    externalCandidateToken = 'mock-external-candidate-token';
  }

  afterAll(async () => {
    // Cleanup
    await userModel.deleteMany({});
    await orgModel.deleteMany({});
    await examModel.deleteMany({});
    await invitationModel.deleteMany({});
    await resultModel.deleteMany({});
    await app.close();
  });

  describe('Exam Type 1: Internal Organization Assessment', () => {
    let internalExam: Exam;

    it('should allow ORG_ADMIN to create internal exam', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/exams')
        .set('Authorization', `Bearer ${techCorpOrgAdminToken}`)
        .send({
          title: 'Q1 Performance Review - Technical Skills',
          description: 'Quarterly internal assessment for all engineers',
          duration: 90,
          totalMarks: 150,
          passingMarks: 90,
          category: ExamCategory.INTERNAL_ASSESSMENT,
          accessMode: ExamAccessMode.ENROLLMENT_BASED,
          organizationId: techCorpOrg._id.toString(),
          questions: [
            {
              text: 'Explain microservices architecture',
              type: 'ESSAY',
              marks: 10,
            },
            {
              text: 'What is Docker?',
              type: 'MCQ',
              marks: 5,
              options: ['Container platform', 'VM tool', 'IDE', 'Database'],
              correctAnswer: 0,
            },
          ],
          isActive: true,
          isPublished: true,
        })
        .expect(201);

      expect(response.body.title).toBe(
        'Q1 Performance Review - Technical Skills',
      );
      expect(response.body.category).toBe(ExamCategory.INTERNAL_ASSESSMENT);
      expect(response.body.accessMode).toBe(ExamAccessMode.ENROLLMENT_BASED);

      internalExam = response.body;
    });

    it('should not allow RECRUITER to create internal exam', async () => {
      await request(app.getHttpServer())
        .post('/api/exams')
        .set('Authorization', `Bearer ${techCorpRecruiterToken}`)
        .send({
          title: 'Internal Exam',
          category: ExamCategory.INTERNAL_ASSESSMENT,
          accessMode: ExamAccessMode.ENROLLMENT_BASED,
        })
        .expect(403);
    });

    it('should allow ORG_ADMIN to enroll internal employees', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/exams/${internalExam._id}/enroll`)
        .set('Authorization', `Bearer ${techCorpOrgAdminToken}`)
        .send({
          studentIds: [techCorpEmployee._id.toString()],
        })
        .expect(200);

      expect(response.body.enrolled).toBe(1);

      // Verify enrollment in database
      const exam = await examModel.findById(internalExam._id);
      expect(exam?.enrolledCandidates).toContain(techCorpEmployee._id);
    });

    it('should not enroll external candidates in internal exam', async () => {
      await request(app.getHttpServer())
        .post(`/api/exams/${internalExam._id}/enroll`)
        .set('Authorization', `Bearer ${techCorpOrgAdminToken}`)
        .send({
          studentIds: [externalCandidate._id.toString()],
        })
        .expect(400);
    });

    it('should allow enrolled employee to access exam', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/student/exams/${internalExam._id}/access`)
        .set('Authorization', `Bearer ${techCorpEmployeeToken}`)
        .expect(200);

      expect(response.body.canAccess).toBe(true);
      expect(response.body.exam.title).toContain('Q1 Performance Review');
    });

    it('should allow employee to take and submit internal exam', async () => {
      // Start exam
      const startResponse = await request(app.getHttpServer())
        .post(`/api/student/exams/${internalExam._id}/start`)
        .set('Authorization', `Bearer ${techCorpEmployeeToken}`)
        .expect(201);

      const sessionId = startResponse.body.sessionId;
      expect(sessionId).toBeDefined();

      // Submit exam
      const submitResponse = await request(app.getHttpServer())
        .post(`/api/student/exams/${internalExam._id}/submit`)
        .set('Authorization', `Bearer ${techCorpEmployeeToken}`)
        .send({
          sessionId,
          answers: [
            { questionId: internalExam.questions[0]._id, answer: 'Microservices are...' },
            { questionId: internalExam.questions[1]._id, answer: 0 },
          ],
        })
        .expect(201);

      expect(submitResponse.body.success).toBe(true);
      expect(submitResponse.body.resultId).toBeDefined();

      // Verify result
      const result = await resultModel.findById(submitResponse.body.resultId);
      expect(result?.student?.toString()).toBe(techCorpEmployee._id.toString());
      expect(result?.isRecruitmentExam).toBe(false);
    });

    it('should allow employee to view their result', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/student/results/${internalExam._id}`)
        .set('Authorization', `Bearer ${techCorpEmployeeToken}`)
        .expect(200);

      expect(response.body.exam.title).toContain('Q1 Performance Review');
      expect(response.body.score).toBeDefined();
    });

    it('should allow ORG_ADMIN to view all internal exam results', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/exams/${internalExam._id}/results`)
        .set('Authorization', `Bearer ${techCorpOrgAdminToken}`)
        .expect(200);

      expect(response.body.results.length).toBeGreaterThan(0);
      expect(response.body.results[0].student.name).toBe('John Employee');
    });
  });

  describe('Exam Type 2: Recruitment Assessment (Invitation-Based)', () => {
    let recruitmentExam: Exam;
    let invitationToken: string;

    it('should allow ORG_ADMIN to create recruitment exam', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/exams')
        .set('Authorization', `Bearer ${techCorpOrgAdminToken}`)
        .send({
          title: 'Senior Software Engineer Screening',
          description: 'Technical assessment for senior engineer position',
          duration: 60,
          totalMarks: 100,
          passingMarks: 70,
          category: ExamCategory.RECRUITMENT,
          accessMode: ExamAccessMode.INVITATION_BASED,
          organizationId: techCorpOrg._id.toString(),
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
            candidateResultMessage:
              'Thank you for completing the assessment. We will contact you within 5 business days.',
            recruiterCanExport: true,
          },
          questions: [
            {
              text: 'Implement a binary search algorithm',
              type: 'CODING',
              marks: 30,
            },
            {
              text: 'What is the time complexity of quicksort?',
              type: 'MCQ',
              marks: 10,
              options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'],
              correctAnswer: 1,
            },
          ],
          isActive: true,
          isPublished: true,
        })
        .expect(201);

      expect(response.body.category).toBe(ExamCategory.RECRUITMENT);
      expect(response.body.accessMode).toBe(
        ExamAccessMode.INVITATION_BASED,
      );

      recruitmentExam = response.body;
    });

    it('should also allow RECRUITER to create recruitment exam', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/exams')
        .set('Authorization', `Bearer ${techCorpRecruiterToken}`)
        .send({
          title: 'Junior Developer Assessment',
          category: ExamCategory.RECRUITMENT,
          accessMode: ExamAccessMode.INVITATION_BASED,
          duration: 45,
          totalMarks: 50,
          questions: [],
        })
        .expect(201);

      expect(response.body.category).toBe(ExamCategory.RECRUITMENT);
    });

    it('should not allow enrollment for invitation-based exam', async () => {
      await request(app.getHttpServer())
        .post(`/api/exams/${recruitmentExam._id}/enroll`)
        .set('Authorization', `Bearer ${techCorpOrgAdminToken}`)
        .send({
          studentIds: [techCorpEmployee._id.toString()],
        })
        .expect(400);
    });

    it('should allow RECRUITER to send invitations', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/exams/${recruitmentExam._id}/invitations`)
        .set('Authorization', `Bearer ${techCorpRecruiterToken}`)
        .send({
          candidates: [
            {
              name: 'Bob Candidate',
              email: 'bob.candidate@gmail.com',
              phone: '+1234567890',
            },
            {
              name: 'Carol Applicant',
              email: 'carol.applicant@yahoo.com',
              phone: '+0987654321',
            },
          ],
          invitationNote:
            'We are excited to invite you to our technical assessment.',
          validityDays: 7,
        })
        .expect(201);

      expect(response.body.summary.sent).toBe(2);
      expect(response.body.summary.failed).toBe(0);
      expect(response.body.details[0].invitationUrl).toContain('/exam/invitation/');

      invitationToken = response.body.details[0].invitationToken;
    });

    it('should allow guest candidate to access exam via invitation (no auth)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/exams/invitation/${invitationToken}`)
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.exam.title).toBe(
        'Senior Software Engineer Screening',
      );
      expect(response.body.candidate.name).toBe('Bob Candidate');
      expect(response.body.canStart).toBe(true);
    });

    it('should allow guest candidate to start exam via invitation', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/exams/invitation/${invitationToken}/start`)
        .expect(201);

      expect(response.body.temporaryToken).toBeDefined();
      expect(response.body.sessionId).toBeDefined();
      expect(response.body.exam).toBeDefined();
      expect(response.body.questions).toBeDefined();

      // Store for next test
      global['guestSessionId'] = response.body.sessionId;
      global['guestTempToken'] = response.body.temporaryToken;
    });

    it('should allow guest candidate to submit exam', async () => {
      const sessionId = global['guestSessionId'];
      const tempToken = global['guestTempToken'];

      const response = await request(app.getHttpServer())
        .post(`/api/student/exams/${recruitmentExam._id}/submit`)
        .set('Authorization', `Bearer ${tempToken}`)
        .send({
          sessionId,
          answers: [
            {
              questionId: recruitmentExam.questions[0]._id,
              answer: 'function binarySearch(arr, target) {...}',
            },
            { questionId: recruitmentExam.questions[1]._id, answer: 1 },
          ],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('submitted successfully');

      // Verify result created without showing score
      const result = await resultModel.findById(response.body.resultId);
      expect(result?.isRecruitmentExam).toBe(true);
      expect(result?.guestCandidateInfo?.email).toBe('bob.candidate@gmail.com');
      expect(result?.student).toBeUndefined();
    });

    it('should not show detailed results to guest candidate', async () => {
      const tempToken = global['guestTempToken'];

      const response = await request(app.getHttpServer())
        .get(`/api/student/results/${recruitmentExam._id}`)
        .set('Authorization', `Bearer ${tempToken}`)
        .expect(200);

      // Should only show confirmation message
      expect(response.body.showScore).toBe(false);
      expect(response.body.message).toContain('Thank you for completing');
    });

    it('should allow RECRUITER to view recruitment results dashboard', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/exams/${recruitmentExam._id}/recruitment-results`)
        .set('Authorization', `Bearer ${techCorpRecruiterToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.stats.totalInvited).toBe(2);
      expect(response.body.stats.completed).toBe(1);
      expect(response.body.data[0].candidateName).toBe('Bob Candidate');
      expect(response.body.data[0].score).toBeDefined();
    });

    it('should allow RECRUITER to shortlist candidates', async () => {
      const resultsResponse = await request(app.getHttpServer())
        .get(`/api/exams/${recruitmentExam._id}/recruitment-results`)
        .set('Authorization', `Bearer ${techCorpRecruiterToken}`)
        .expect(200);

      const invitationId = resultsResponse.body.data[0].invitationId;

      await request(app.getHttpServer())
        .post(`/api/exams/${recruitmentExam._id}/recruitment-results/shortlist`)
        .set('Authorization', `Bearer ${techCorpRecruiterToken}`)
        .send({
          invitationIds: [invitationId],
          action: 'shortlist',
          comments: 'Excellent coding skills',
        })
        .expect(200);

      // Verify shortlist decision
      const result = await resultModel.findOne({ invitationId });
      expect(result?.shortlistingDecision?.isShortlisted).toBe(true);
      expect(result?.shortlistingDecision?.comments).toBe(
        'Excellent coding skills',
      );
    });

    it('should allow RECRUITER to export recruitment results', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/exams/${recruitmentExam._id}/recruitment-results/export`)
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${techCorpRecruiterToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.text).toContain('Bob Candidate');
    });

    it('should prevent access after invitation is completed', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/exams/invitation/${invitationToken}`)
        .expect(200);

      expect(response.body.canStart).toBe(false);
      expect(response.body.message).toContain('already been used');
    });
  });

  describe('Exam Type 3: General Assessment (Registered External Candidates)', () => {
    let generalExam: Exam;

    it('should allow ORG_ADMIN to create general assessment exam', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/exams')
        .set('Authorization', `Bearer ${techCorpOrgAdminToken}`)
        .send({
          title: 'Cloud Fundamentals Certification',
          description: 'Assessment for external candidates seeking certification',
          duration: 120,
          totalMarks: 200,
          passingMarks: 140,
          category: ExamCategory.GENERAL_ASSESSMENT,
          accessMode: ExamAccessMode.ENROLLMENT_BASED,
          organizationId: techCorpOrg._id.toString(),
          questions: [
            {
              text: 'Explain AWS EC2',
              type: 'ESSAY',
              marks: 20,
            },
            {
              text: 'What is a VPC?',
              type: 'MCQ',
              marks: 10,
              options: [
                'Virtual Private Cloud',
                'Virtual Public Cloud',
                'Verified Private Cloud',
                'None',
              ],
              correctAnswer: 0,
            },
          ],
          isActive: true,
          isPublished: true,
        })
        .expect(201);

      expect(response.body.category).toBe(ExamCategory.GENERAL_ASSESSMENT);
      expect(response.body.accessMode).toBe(ExamAccessMode.ENROLLMENT_BASED);

      generalExam = response.body;
    });

    it('should allow ORG_ADMIN to enroll external candidates', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/exams/${generalExam._id}/enroll`)
        .set('Authorization', `Bearer ${techCorpOrgAdminToken}`)
        .send({
          studentIds: [externalCandidate._id.toString()],
        })
        .expect(200);

      expect(response.body.enrolled).toBe(1);

      // Verify enrollment
      const exam = await examModel.findById(generalExam._id);
      expect(exam?.enrolledCandidates).toContain(externalCandidate._id);
    });

    it('should allow enrolled external candidate to access exam', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/student/exams/${generalExam._id}/access`)
        .set('Authorization', `Bearer ${externalCandidateToken}`)
        .expect(200);

      expect(response.body.canAccess).toBe(true);
      expect(response.body.exam.title).toBe('Cloud Fundamentals Certification');
    });

    it('should allow external candidate to take and submit exam', async () => {
      // Start exam
      const startResponse = await request(app.getHttpServer())
        .post(`/api/student/exams/${generalExam._id}/start`)
        .set('Authorization', `Bearer ${externalCandidateToken}`)
        .expect(201);

      const sessionId = startResponse.body.sessionId;

      // Submit exam
      const submitResponse = await request(app.getHttpServer())
        .post(`/api/student/exams/${generalExam._id}/submit`)
        .set('Authorization', `Bearer ${externalCandidateToken}`)
        .send({
          sessionId,
          answers: [
            {
              questionId: generalExam.questions[0]._id,
              answer: 'AWS EC2 is a compute service...',
            },
            { questionId: generalExam.questions[1]._id, answer: 0 },
          ],
        })
        .expect(201);

      expect(submitResponse.body.success).toBe(true);

      // Verify result
      const result = await resultModel.findById(submitResponse.body.resultId);
      expect(result?.student?.toString()).toBe(
        externalCandidate._id.toString(),
      );
      expect(result?.isRecruitmentExam).toBe(false);
    });

    it('should allow external candidate to view their result with full details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/student/results/${generalExam._id}`)
        .set('Authorization', `Bearer ${externalCandidateToken}`)
        .expect(200);

      expect(response.body.exam.title).toBe('Cloud Fundamentals Certification');
      expect(response.body.score).toBeDefined();
      expect(response.body.percentage).toBeDefined();
      expect(response.body.isPassed).toBeDefined();
    });

    it('should allow ORG_ADMIN to view general assessment results', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/exams/${generalExam._id}/results`)
        .set('Authorization', `Bearer ${techCorpOrgAdminToken}`)
        .expect(200);

      expect(response.body.results.length).toBeGreaterThan(0);
      expect(response.body.results[0].student.email).toBe(
        'alice.external@gmail.com',
      );
    });

    it('should not allow RECRUITER to access general assessment results', async () => {
      await request(app.getHttpServer())
        .get(`/api/exams/${generalExam._id}/results`)
        .set('Authorization', `Bearer ${techCorpRecruiterToken}`)
        .expect(403);
    });
  });

  describe('Hybrid Access Mode', () => {
    let hybridExam: Exam;
    let hybridInvitationToken: string;

    it('should allow ORG_ADMIN to create hybrid exam', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/exams')
        .set('Authorization', `Bearer ${techCorpOrgAdminToken}`)
        .send({
          title: 'Certification Exam - Hybrid Access',
          description: 'Supports both enrollment and invitation-based access',
          duration: 90,
          totalMarks: 100,
          category: ExamCategory.GENERAL_ASSESSMENT,
          accessMode: ExamAccessMode.HYBRID,
          organizationId: techCorpOrg._id.toString(),
          invitationSettings: {
            linkValidityDays: 14,
            allowMultipleAccess: true,
            maxAccessCount: 5,
          },
          questions: [],
          isActive: true,
          isPublished: true,
        })
        .expect(201);

      expect(response.body.accessMode).toBe(ExamAccessMode.HYBRID);
      hybridExam = response.body;
    });

    it('should allow enrollment for hybrid exam', async () => {
      await request(app.getHttpServer())
        .post(`/api/exams/${hybridExam._id}/enroll`)
        .set('Authorization', `Bearer ${techCorpOrgAdminToken}`)
        .send({
          studentIds: [techCorpEmployee._id.toString()],
        })
        .expect(200);
    });

    it('should also allow invitations for hybrid exam', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/exams/${hybridExam._id}/invitations`)
        .set('Authorization', `Bearer ${techCorpOrgAdminToken}`)
        .send({
          candidates: [
            { name: 'David Hybrid', email: 'david@example.com' },
          ],
          validityDays: 14,
        })
        .expect(201);

      expect(response.body.summary.sent).toBe(1);
      hybridInvitationToken = response.body.details[0].invitationToken;
    });

    it('should allow enrolled user to access hybrid exam', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/student/exams/${hybridExam._id}/access`)
        .set('Authorization', `Bearer ${techCorpEmployeeToken}`)
        .expect(200);

      expect(response.body.canAccess).toBe(true);
    });

    it('should allow invited guest to access hybrid exam', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/exams/invitation/${hybridInvitationToken}`)
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.canStart).toBe(true);
    });
  });

  describe('Cross-Organization Isolation', () => {
    let consultingExam: Exam;

    it('should create exam in ConsultingFirm organization', async () => {
      const consultingAdmin = await userModel.create({
        name: 'Consulting Admin',
        email: 'admin@consultingfirm.com',
        password: '$2b$10$hashedPassword',
        role: UserRole.ORG_ADMIN,
        organizationId: consultingFirmOrg._id,
        isActive: true,
      });

      const token = 'mock-consulting-admin-token';

      const response = await request(app.getHttpServer())
        .post('/api/exams')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Consulting Exam',
          category: ExamCategory.INTERNAL_ASSESSMENT,
          accessMode: ExamAccessMode.ENROLLMENT_BASED,
          duration: 60,
          totalMarks: 100,
          organizationId: consultingFirmOrg._id.toString(),
          questions: [],
        })
        .expect(201);

      consultingExam = response.body;
    });

    it('should not allow TechCorp users to access ConsultingFirm exam', async () => {
      await request(app.getHttpServer())
        .get(`/api/student/exams/${consultingExam._id}/access`)
        .set('Authorization', `Bearer ${techCorpEmployeeToken}`)
        .expect(403);
    });

    it('should not allow TechCorp admin to view ConsultingFirm exam results', async () => {
      await request(app.getHttpServer())
        .get(`/api/exams/${consultingExam._id}/results`)
        .set('Authorization', `Bearer ${techCorpOrgAdminToken}`)
        .expect(403);
    });

    it('should allow SUPER_ADMIN to access all organization exams', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/exams')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const examTitles = response.body.exams.map((e) => e.title);
      expect(examTitles).toContain('Consulting Exam');
      expect(examTitles).toContain(
        'Q1 Performance Review - Technical Skills',
      );
    });
  });

  describe('Role-Based Access Control', () => {
    it('should prevent RECRUITER from creating internal assessment', async () => {
      await request(app.getHttpServer())
        .post('/api/exams')
        .set('Authorization', `Bearer ${techCorpRecruiterToken}`)
        .send({
          title: 'Internal Exam',
          category: ExamCategory.INTERNAL_ASSESSMENT,
          accessMode: ExamAccessMode.ENROLLMENT_BASED,
        })
        .expect(403);
    });

    it('should prevent RECRUITER from creating general assessment', async () => {
      await request(app.getHttpServer())
        .post('/api/exams')
        .set('Authorization', `Bearer ${techCorpRecruiterToken}`)
        .send({
          title: 'General Exam',
          category: ExamCategory.GENERAL_ASSESSMENT,
          accessMode: ExamAccessMode.ENROLLMENT_BASED,
        })
        .expect(403);
    });

    it('should allow RECRUITER to only create recruitment exams', async () => {
      await request(app.getHttpServer())
        .post('/api/exams')
        .set('Authorization', `Bearer ${techCorpRecruiterToken}`)
        .send({
          title: 'Recruitment Exam',
          category: ExamCategory.RECRUITMENT,
          accessMode: ExamAccessMode.INVITATION_BASED,
        })
        .expect(201);
    });

    it('should prevent CANDIDATE from creating any exam', async () => {
      await request(app.getHttpServer())
        .post('/api/exams')
        .set('Authorization', `Bearer ${techCorpEmployeeToken}`)
        .send({
          title: 'Any Exam',
          category: ExamCategory.RECRUITMENT,
        })
        .expect(403);
    });
  });
});
