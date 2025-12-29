import {
  Controller,
  Post,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/schemas/user.schema';
// import { up as runMigration } from '../../../migrations/001-multi-exam-type-schema-migration';

@ApiTags('admin-migration')
@Controller('admin/migration')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MigrationController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /**
   * POST /admin/migration/run
   * Trigger the multi-exam type schema migration
   * Only accessible by SUPER_ADMIN
   */
  @Post('run')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Run schema migration',
    description: 'Manually trigger the multi-exam type schema migration (SUPER_ADMIN only)',
  })
  @ApiResponse({ status: 200, description: 'Migration completed successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - SUPER_ADMIN only' })
  async runSchemaMigration(@Request() req) {
    try {
      console.log(`Migration triggered by user: ${req.user.id} (${req.user.email})`);

      // await runMigration(this.connection);

      return {
        success: true,
        message: 'Schema migration feature temporarily disabled - migration file moved',
        triggeredBy: req.user.email,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Migration failed',
        error: error.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * GET /admin/migration/status
   * Check migration status and role distribution
   * Accessible by SUPER_ADMIN and ORG_ADMIN
   */
  @Get('status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({
    summary: 'Get migration status',
    description: 'Check role distribution and migration status',
  })
  @ApiResponse({ status: 200, description: 'Status retrieved successfully' })
  async getMigrationStatus() {
    const userCollection = this.connection.collection('users');
    const examCollection = this.connection.collection('exams');
    const invitationCollection = this.connection.collection('examinvitations');

    // Get role distribution
    const roleDistribution = await userCollection.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]).toArray();

    // Get deprecated roles count
    const deprecatedRoles = roleDistribution.filter(r =>
      ['INSTRUCTOR', 'ADMIN', 'STUDENT', 'PROCTOR'].includes(r._id)
    );

    const deprecatedCount = deprecatedRoles.reduce((sum, r) => sum + r.count, 0);

    // Get exam category distribution
    const examCategories = await examCollection.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
    ]).toArray();

    // Get exam access mode distribution
    const examAccessModes = await examCollection.aggregate([
      {
        $group: {
          _id: '$accessMode',
          count: { $sum: 1 },
        },
      },
    ]).toArray();

    // Get invitation stats
    const invitationStats = await invitationCollection.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]).toArray();

    const totalInvitations = invitationStats.reduce((sum, s) => sum + s.count, 0);

    // Get exams without category/accessMode (not migrated yet)
    const examsWithoutCategory = await examCollection.countDocuments({
      category: { $exists: false },
    });

    const examsWithoutAccessMode = await examCollection.countDocuments({
      accessMode: { $exists: false },
    });

    return {
      migrationComplete: deprecatedCount === 0 && examsWithoutCategory === 0,
      users: {
        total: roleDistribution.reduce((sum, r) => sum + r.count, 0),
        roleDistribution: roleDistribution.map(r => ({
          role: r._id,
          count: r.count,
          isDeprecated: ['INSTRUCTOR', 'ADMIN', 'STUDENT', 'PROCTOR'].includes(r._id),
        })),
        deprecatedRolesCount: deprecatedCount,
      },
      exams: {
        total: await examCollection.countDocuments(),
        categoryDistribution: examCategories,
        accessModeDistribution: examAccessModes,
        withoutCategory: examsWithoutCategory,
        withoutAccessMode: examsWithoutAccessMode,
      },
      invitations: {
        total: totalInvitations,
        statusDistribution: invitationStats,
      },
      recommendation:
        deprecatedCount > 0
          ? 'Run migration to update deprecated user roles'
          : examsWithoutCategory > 0
          ? 'Run migration to update exam categories and access modes'
          : 'System is fully migrated',
    };
  }

  /**
   * GET /admin/migration/deprecated-users
   * List users with deprecated roles
   * Accessible by SUPER_ADMIN only
   */
  @Get('deprecated-users')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List users with deprecated roles',
    description: 'Get list of users that still have deprecated roles',
  })
  @ApiResponse({ status: 200, description: 'Deprecated users retrieved' })
  async getDeprecatedUsers() {
    const userCollection = this.connection.collection('users');

    const deprecatedUsers = await userCollection
      .find({
        role: { $in: ['INSTRUCTOR', 'ADMIN', 'STUDENT', 'PROCTOR'] },
      })
      .project({
        _id: 1,
        name: 1,
        email: 1,
        role: 1,
        createdAt: 1,
        lastLogin: 1,
      })
      .limit(100)
      .toArray();

    return {
      count: deprecatedUsers.length,
      users: deprecatedUsers,
      migration: {
        INSTRUCTOR: 'ORG_ADMIN',
        ADMIN: 'ORG_ADMIN',
        STUDENT: 'CANDIDATE',
        PROCTOR: 'ORG_ADMIN',
      },
    };
  }
}
