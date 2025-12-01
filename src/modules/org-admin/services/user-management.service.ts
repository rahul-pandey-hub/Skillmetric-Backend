import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email: dto.email });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Validate role
    if (dto.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Cannot create SUPER_ADMIN users');
    }

    // Generate password if not provided
    const tempPassword = dto.password || this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Create user
    const user = new this.userModel({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role: dto.role,
      organizationId,
      isActive: true,
      emailVerified: true,
      metadata: {
        phone: dto.phone,
        department: dto.department,
        batch: dto.batch,
      },
      ...(dto.studentId && { studentId: dto.studentId }),
    });

    await user.save();

    // Send welcome email with credentials
    try {
      await this.emailService.queueStudentWelcomeEmail({
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

    const query: any = { organizationId };

    if (role) query.role = role;
    if (department) query['metadata.department'] = department;
    if (batch) query['metadata.batch'] = batch;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

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
    const user = await this.userModel
      .findOne({ _id: id, organizationId })
      .select('-password')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUser(id: string, dto: UpdateUserDto, organizationId: string) {
    const user = await this.userModel
      .findOneAndUpdate(
        { _id: id, organizationId },
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
    const user = await this.userModel.findOne({ _id: id, organizationId });

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
    const user = await this.userModel.findOneAndDelete({
      _id: id,
      organizationId,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

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
