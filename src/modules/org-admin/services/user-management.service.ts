import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../../users/schemas/user.schema';
import { CreateUserDto, UpdateUserDto } from '../dto/create-user.dto';
import { UserFiltersDto } from '../dto/user-filters.dto';
import { EmailService } from '../../email/services/email.service';

@Injectable()
export class UserManagementService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private emailService: EmailService,
  ) {}

  async createUser(dto: CreateUserDto, organizationId: string) {
    const orgId = organizationId ? new Types.ObjectId(organizationId) : null;

    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email: dto.email });

    if (existingUser) {
      // User exists - check if they already belong to this organization
      const hasOrganization = existingUser.organizationIds.some(
        (id) => id.toString() === orgId?.toString()
      );

      if (hasOrganization) {
        throw new ConflictException(
          'User with this email already belongs to this organization'
        );
      }

      // Add organization to existing user
      existingUser.organizationIds.push(orgId);
      await existingUser.save();

      return {
        user: {
          _id: existingUser._id,
          name: existingUser.name,
          email: existingUser.email,
          role: existingUser.role,
          isActive: existingUser.isActive,
        },
        message: 'User added to organization successfully',
      };
    }

    // Validate role
    if (dto.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Cannot create SUPER_ADMIN users');
    }

    // Generate password if not provided
    const tempPassword = dto.password || this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Create new user
    const user = new this.userModel({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role: dto.role,
      organizationIds: orgId ? [orgId] : [],
      isActive: true,
      emailVerified: true,
      metadata: {
        phone: dto.phone,
        department: dto.department,
        batch: dto.batch,
      },
      ...(dto.candidateId && { candidateId: dto.candidateId }),
    });

    await user.save();

    // Send welcome email with credentials
    try {
      await this.emailService.queueCandidateWelcomeEmail({
        name: user.name,
        email: user.email,
        tempPassword,
        isNewUser: true,
      });
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      temporaryPassword: dto.password ? undefined : tempPassword,
    };
  }

  async bulkCreateUsers(users: CreateUserDto[], organizationId: string) {
    const results = {
      success: [],
      failed: [],
    };

    for (const userDto of users) {
      try {
        const result = await this.createUser(userDto, organizationId);
        results.success.push({
          email: userDto.email,
          name: userDto.name,
          ...result,
        });
      } catch (error) {
        results.failed.push({
          email: userDto.email,
          name: userDto.name,
          error: error.message,
        });
      }
    }

    return results;
  }

  async getAllUsers(filters: UserFiltersDto, organizationId: string) {
    const { role, search, department, batch, page = 1, limit = 10 } = filters;

    console.log('🔍 [DEBUG] getAllUsers called with:');
    console.log('  - organizationId (raw):', organizationId);
    console.log('  - organizationId type:', typeof organizationId);
    console.log('  - filters:', filters);

    // Convert organizationId string to ObjectId for MongoDB query
    const orgIdObject = organizationId ? new Types.ObjectId(organizationId) : null;
    console.log('  - organizationId (ObjectId):', orgIdObject);

    const query: any = {
      organizationIds: { $in: [orgIdObject] }
    };

    if (role) query.role = role;
    if (department) query['metadata.department'] = department;
    if (batch) query['metadata.batch'] = batch;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    console.log('  - Final query:', JSON.stringify(query, null, 2));

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.userModel
        .find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(query),
    ]);

    console.log('  - Users found:', users.length);
    console.log('  - Total count:', total);
    if (users.length > 0) {
      console.log('  - First user:', users[0].email);
    }

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(id: string, organizationId: string) {
    const orgId = organizationId ? new Types.ObjectId(organizationId) : null;
    const user = await this.userModel
      .findOne({
        _id: id,
        organizationIds: { $in: [orgId] }
      })
      .select('-password')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUser(id: string, dto: UpdateUserDto, organizationId: string) {
    const orgId = organizationId ? new Types.ObjectId(organizationId) : null;
    const user = await this.userModel
      .findOneAndUpdate(
        {
          _id: id,
          organizationIds: { $in: [orgId] }
        },
        {
          ...(dto.name && { name: dto.name }),
          ...(dto.email && { email: dto.email }),
          ...(dto.phone || dto.department || dto.batch
            ? {
                metadata: {
                  ...(dto.phone && { phone: dto.phone }),
                  ...(dto.department && { department: dto.department }),
                  ...(dto.batch && { batch: dto.batch }),
                },
              }
            : {}),
        },
        { new: true },
      )
      .select('-password')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async toggleUserStatus(id: string, organizationId: string) {
    const orgId = organizationId ? new Types.ObjectId(organizationId) : null;
    const user = await this.userModel.findOne({
      _id: id,
      organizationIds: { $in: [orgId] }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isActive = !user.isActive;
    await user.save();

    return {
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: user.isActive,
    };
  }

  async deleteUser(id: string, organizationId: string) {
    const orgId = organizationId ? new Types.ObjectId(organizationId) : null;
    // For multi-org users, remove org from array instead of deleting user
    const user = await this.userModel.findOne({
      _id: id,
      organizationIds: { $in: [orgId] }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If user belongs to multiple orgs, just remove this org
    if (user.organizationIds.length > 1) {
      user.organizationIds = user.organizationIds.filter(
        (oid) => oid.toString() !== orgId?.toString()
      );
      await user.save();
      return { message: 'User removed from organization successfully' };
    }

    // If only one org, delete the user entirely
    await this.userModel.findByIdAndDelete(id);
    return { message: 'User deleted successfully' };
  }

  private generateTemporaryPassword(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}
