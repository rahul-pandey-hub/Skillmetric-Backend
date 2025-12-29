import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InvitationTokenService } from './invitation-token.service';
import { ExamInvitation, InvitationStatus } from '../schemas/exam-invitation.schema';

describe('InvitationTokenService', () => {
  let service: InvitationTokenService;
  let invitationModel: Model<ExamInvitation>;

  const mockInvitationModel = {
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationTokenService,
        {
          provide: getModelToken(ExamInvitation.name),
          useValue: mockInvitationModel,
        },
      ],
    }).compile();

    service = module.get<InvitationTokenService>(InvitationTokenService);
    invitationModel = module.get<Model<ExamInvitation>>(
      getModelToken(ExamInvitation.name),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a valid UUID v4 token', () => {
      const token = service.generateToken();

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(token).toMatch(uuidRegex);
    });

    it('should generate unique tokens', () => {
      const token1 = service.generateToken();
      const token2 = service.generateToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('calculateExpiry', () => {
    it('should calculate correct expiry date for 7 days', () => {
      const validityDays = 7;
      const now = Date.now();
      const expectedExpiry = now + validityDays * 24 * 60 * 60 * 1000;

      const result = service.calculateExpiry(validityDays);

      // Allow 1 second tolerance for test execution time
      expect(result.getTime()).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(result.getTime()).toBeLessThanOrEqual(expectedExpiry + 1000);
    });

    it('should calculate correct expiry date for 1 day', () => {
      const validityDays = 1;
      const now = Date.now();
      const expectedExpiry = now + validityDays * 24 * 60 * 60 * 1000;

      const result = service.calculateExpiry(validityDays);

      expect(result.getTime()).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(result.getTime()).toBeLessThanOrEqual(expectedExpiry + 1000);
    });

    it('should calculate correct expiry date for 30 days', () => {
      const validityDays = 30;
      const now = Date.now();
      const expectedExpiry = now + validityDays * 24 * 60 * 60 * 1000;

      const result = service.calculateExpiry(validityDays);

      expect(result.getTime()).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(result.getTime()).toBeLessThanOrEqual(expectedExpiry + 1000);
    });
  });

  describe('validateToken', () => {
    const mockToken = '123e4567-e89b-12d3-a456-426614174000';

    it('should return invitation for valid token', async () => {
      const mockInvitation = {
        _id: new Types.ObjectId(),
        invitationToken: mockToken,
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      };

      mockInvitationModel.findOne.mockReturnValue({
        exec: jest.fn().resolveValue(mockInvitation),
      } as any);

      const result = await service.validateToken(mockToken);

      expect(result).toEqual(mockInvitation);
      expect(mockInvitationModel.findOne).toHaveBeenCalledWith({
        invitationToken: mockToken,
      });
    });

    it('should throw NotFoundException for non-existent token', async () => {
      mockInvitationModel.findOne.mockReturnValue({
        exec: jest.fn().resolveValue(null),
      } as any);

      await expect(service.validateToken(mockToken)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.validateToken(mockToken)).rejects.toThrow(
        'Invalid invitation token',
      );
    });

    it('should throw BadRequestException for expired invitation', async () => {
      const mockInvitation = {
        _id: new Types.ObjectId(),
        invitationToken: mockToken,
        status: InvitationStatus.EXPIRED,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      };

      mockInvitationModel.findOne.mockReturnValue({
        exec: jest.fn().resolveValue(mockInvitation),
      } as any);

      await expect(service.validateToken(mockToken)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.validateToken(mockToken)).rejects.toThrow(
        'Invitation has already expired',
      );
    });

    it('should throw BadRequestException for revoked invitation', async () => {
      const mockInvitation = {
        _id: new Types.ObjectId(),
        invitationToken: mockToken,
        status: InvitationStatus.REVOKED,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      mockInvitationModel.findOne.mockReturnValue({
        exec: jest.fn().resolveValue(mockInvitation),
      } as any);

      await expect(service.validateToken(mockToken)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.validateToken(mockToken)).rejects.toThrow(
        'Invitation has been revoked',
      );
    });

    it('should throw BadRequestException for completed invitation', async () => {
      const mockInvitation = {
        _id: new Types.ObjectId(),
        invitationToken: mockToken,
        status: InvitationStatus.COMPLETED,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      mockInvitationModel.findOne.mockReturnValue({
        exec: jest.fn().resolveValue(mockInvitation),
      } as any);

      await expect(service.validateToken(mockToken)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.validateToken(mockToken)).rejects.toThrow(
        'Invitation has already been used',
      );
    });

    it('should throw BadRequestException for invitation past expiry date', async () => {
      const mockInvitation = {
        _id: new Types.ObjectId(),
        invitationToken: mockToken,
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
        save: jest.fn().resolveValue(true),
      };

      mockInvitationModel.findOne.mockReturnValue({
        exec: jest.fn().resolveValue(mockInvitation),
      } as any);

      await expect(service.validateToken(mockToken)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.validateToken(mockToken)).rejects.toThrow(
        'Invitation has expired',
      );

      // Should update status to EXPIRED
      expect(mockInvitation.status).toBe(InvitationStatus.EXPIRED);
      expect(mockInvitation.save).toHaveBeenCalled();
    });
  });

  describe('checkDuplicateInvitation', () => {
    const examId = new Types.ObjectId().toString();
    const email = 'candidate@example.com';

    it('should return null if no duplicate found', async () => {
      mockInvitationModel.findOne.mockReturnValue({
        exec: jest.fn().resolveValue(null),
      } as any);

      const result = await service.checkDuplicateInvitation(examId, email);

      expect(result).toBeNull();
      expect(mockInvitationModel.findOne).toHaveBeenCalledWith({
        examId,
        candidateEmail: email.toLowerCase(),
        status: { $in: [InvitationStatus.PENDING, InvitationStatus.ACCESSED] },
      });
    });

    it('should return existing invitation if duplicate found', async () => {
      const mockInvitation = {
        _id: new Types.ObjectId(),
        examId,
        candidateEmail: email.toLowerCase(),
        status: InvitationStatus.PENDING,
      };

      mockInvitationModel.findOne.mockReturnValue({
        exec: jest.fn().resolveValue(mockInvitation),
      } as any);

      const result = await service.checkDuplicateInvitation(examId, email);

      expect(result).toEqual(mockInvitation);
    });

    it('should handle email case-insensitively', async () => {
      const upperEmail = 'CANDIDATE@EXAMPLE.COM';

      mockInvitationModel.findOne.mockReturnValue({
        exec: jest.fn().resolveValue(null),
      } as any);

      await service.checkDuplicateInvitation(examId, upperEmail);

      expect(mockInvitationModel.findOne).toHaveBeenCalledWith({
        examId,
        candidateEmail: upperEmail.toLowerCase(),
        status: { $in: [InvitationStatus.PENDING, InvitationStatus.ACCESSED] },
      });
    });
  });

  describe('markAsStarted', () => {
    const invitationId = new Types.ObjectId().toString();
    const sessionId = new Types.ObjectId().toString();

    it('should update invitation status to STARTED', async () => {
      const mockInvitation = {
        _id: invitationId,
        status: InvitationStatus.ACCESSED,
        save: jest.fn().resolveValue(true),
      };

      mockInvitationModel.findById.mockReturnValue({
        exec: jest.fn().resolveValue(mockInvitation),
      } as any);

      await service.markAsStarted(invitationId, sessionId);

      expect(mockInvitation.status).toBe(InvitationStatus.STARTED);
      expect(mockInvitation.save).toHaveBeenCalled();
    });

    it('should set examStartedAt timestamp', async () => {
      const mockInvitation = {
        _id: invitationId,
        status: InvitationStatus.PENDING,
        examStartedAt: undefined,
        save: jest.fn().resolveValue(true),
      };

      mockInvitationModel.findById.mockReturnValue({
        exec: jest.fn().resolveValue(mockInvitation),
      } as any);

      const beforeTime = new Date();
      await service.markAsStarted(invitationId, sessionId);
      const afterTime = new Date();

      expect(mockInvitation.examStartedAt).toBeDefined();
      expect(mockInvitation.examStartedAt).toBeInstanceOf(Date);
      expect(mockInvitation.examStartedAt.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime(),
      );
      expect(mockInvitation.examStartedAt.getTime()).toBeLessThanOrEqual(
        afterTime.getTime(),
      );
    });

    it('should set sessionId', async () => {
      const mockInvitation = {
        _id: invitationId,
        status: InvitationStatus.PENDING,
        sessionId: undefined,
        save: jest.fn().resolveValue(true),
      };

      mockInvitationModel.findById.mockReturnValue({
        exec: jest.fn().resolveValue(mockInvitation),
      } as any);

      await service.markAsStarted(invitationId, sessionId);

      expect(mockInvitation.sessionId).toBe(sessionId);
    });
  });

  describe('markAsCompleted', () => {
    const invitationId = new Types.ObjectId().toString();
    const resultId = new Types.ObjectId().toString();

    it('should update invitation status to COMPLETED', async () => {
      const mockInvitation = {
        _id: invitationId,
        status: InvitationStatus.STARTED,
        save: jest.fn().resolveValue(true),
      };

      mockInvitationModel.findById.mockReturnValue({
        exec: jest.fn().resolveValue(mockInvitation),
      } as any);

      await service.markAsCompleted(invitationId, resultId);

      expect(mockInvitation.status).toBe(InvitationStatus.COMPLETED);
      expect(mockInvitation.save).toHaveBeenCalled();
    });

    it('should set examCompletedAt timestamp', async () => {
      const mockInvitation = {
        _id: invitationId,
        status: InvitationStatus.STARTED,
        examCompletedAt: undefined,
        save: jest.fn().resolveValue(true),
      };

      mockInvitationModel.findById.mockReturnValue({
        exec: jest.fn().resolveValue(mockInvitation),
      } as any);

      const beforeTime = new Date();
      await service.markAsCompleted(invitationId, resultId);
      const afterTime = new Date();

      expect(mockInvitation.examCompletedAt).toBeDefined();
      expect(mockInvitation.examCompletedAt).toBeInstanceOf(Date);
      expect(mockInvitation.examCompletedAt.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime(),
      );
      expect(mockInvitation.examCompletedAt.getTime()).toBeLessThanOrEqual(
        afterTime.getTime(),
      );
    });

    it('should set resultId', async () => {
      const mockInvitation = {
        _id: invitationId,
        status: InvitationStatus.STARTED,
        resultId: undefined,
        save: jest.fn().resolveValue(true),
      };

      mockInvitationModel.findById.mockReturnValue({
        exec: jest.fn().resolveValue(mockInvitation),
      } as any);

      await service.markAsCompleted(invitationId, resultId);

      expect(mockInvitation.resultId).toBe(resultId);
    });
  });

  describe('expireExpiredInvitations', () => {
    it('should update expired invitations to EXPIRED status', async () => {
      const mockResult = { modifiedCount: 5 };

      mockInvitationModel.updateMany.mockReturnValue({
        exec: jest.fn().resolveValue(mockResult),
      } as any);

      const result = await service.expireExpiredInvitations();

      expect(result).toBe(5);
      expect(mockInvitationModel.updateMany).toHaveBeenCalled();

      const callArgs = mockInvitationModel.updateMany.mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        status: { $in: [InvitationStatus.PENDING, InvitationStatus.ACCESSED] },
      });
      expect(callArgs[0].expiresAt).toHaveProperty('$lt');
      expect(callArgs[1]).toEqual({ status: InvitationStatus.EXPIRED });
    });

    it('should return 0 if no invitations expired', async () => {
      const mockResult = { modifiedCount: 0 };

      mockInvitationModel.updateMany.mockReturnValue({
        exec: jest.fn().resolveValue(mockResult),
      } as any);

      const result = await service.expireExpiredInvitations();

      expect(result).toBe(0);
    });
  });

  describe('getExpiringInvitations', () => {
    it('should return invitations expiring within specified hours', async () => {
      const hoursUntilExpiry = 24;
      const mockInvitations = [
        {
          _id: new Types.ObjectId(),
          candidateEmail: 'test1@example.com',
          expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
        },
        {
          _id: new Types.ObjectId(),
          candidateEmail: 'test2@example.com',
          expiresAt: new Date(Date.now() + 20 * 60 * 60 * 1000), // 20 hours
        },
      ];

      mockInvitationModel.find.mockReturnValue({
        populate: jest.fn().returnsThis(),
        exec: jest.fn().resolveValue(mockInvitations),
      } as any);

      const result = await service.getExpiringInvitations(hoursUntilExpiry);

      expect(result).toEqual(mockInvitations);
      expect(mockInvitationModel.find).toHaveBeenCalled();

      const callArgs = mockInvitationModel.find.mock.calls[0][0];
      expect(callArgs.status).toEqual(InvitationStatus.PENDING);
      expect(callArgs.expiresAt).toHaveProperty('$gt');
      expect(callArgs.expiresAt).toHaveProperty('$lt');
    });

    it('should populate examId field', async () => {
      const mockInvitations = [];
      const mockQuery = {
        populate: jest.fn().returnsThis(),
        exec: jest.fn().resolveValue(mockInvitations),
      };

      mockInvitationModel.find.mockReturnValue(mockQuery as any);

      await service.getExpiringInvitations(24);

      expect(mockQuery.populate).toHaveBeenCalledWith(
        'examId',
        'title description duration',
      );
    });
  });
});
