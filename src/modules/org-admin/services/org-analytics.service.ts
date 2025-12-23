import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Question } from '../../questions/schemas/question.schema';

@Injectable()
export class OrgAnalyticsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Question.name) private questionModel: Model<Question>,
  ) {}

  async getOrganizationStats(organizationId: string) {
    console.log('🔍 Querying with organizationId:', organizationId, 'Type:', typeof organizationId);

    // Convert to ObjectId
    const orgId = organizationId ? new Types.ObjectId(organizationId) : null;
    console.log('🔍 Converted to ObjectId:', orgId);

    const [
      totalUsers,
      activeUsers,
      totalQuestions,
      activeQuestions,
      usersByRole,
      usersByDepartment,
    ] = await Promise.all([
      this.userModel.countDocuments({ organizationIds: { $in: [orgId] } }),
      this.userModel.countDocuments({ organizationIds: { $in: [orgId] }, isActive: true }),
      this.questionModel.countDocuments({ organizationId: orgId }),
      this.questionModel.countDocuments({ organizationId: orgId, isActive: true }),
      this.userModel.aggregate([
        { $match: { organizationIds: { $in: [orgId] } } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      this.userModel.aggregate([
        { $match: { organizationIds: { $in: [orgId] } } },
        { $group: { _id: '$metadata.department', count: { $sum: 1 } } },
      ]),
    ]);

    console.log('📊 Query results - Users:', totalUsers, 'Questions:', totalQuestions);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        byRole: usersByRole,
      },
      questions: {
        total: totalQuestions,
        active: activeQuestions,
        inactive: totalQuestions - activeQuestions,
      },
      departments: usersByDepartment.filter(d => d._id),
    };
  }

  async getDepartmentComparison(organizationId: string) {
    const orgId = organizationId ? new Types.ObjectId(organizationId) : null;
    const departmentStats = await this.userModel.aggregate([
      { $match: { organizationIds: { $in: [orgId] } } },
      {
        $group: {
          _id: '$metadata.department',
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] },
          },
        },
      },
      { $match: { _id: { $ne: null } } },
      { $sort: { totalUsers: -1 } },
    ]);

    return departmentStats;
  }

  async getBatchComparison(organizationId: string) {
    const orgId = organizationId ? new Types.ObjectId(organizationId) : null;
    const batchStats = await this.userModel.aggregate([
      { $match: { organizationIds: { $in: [orgId] } } },
      {
        $group: {
          _id: '$metadata.batch',
          totalStudents: { $sum: 1 },
          activeStudents: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] },
          },
        },
      },
      { $match: { _id: { $ne: null } } },
      { $sort: { _id: -1 } },
    ]);

    return batchStats;
  }

  async getQuestionBankAnalytics(organizationId: string) {
    const orgId = organizationId ? new Types.ObjectId(organizationId) : null;
    const [questionsByType, questionsByDifficulty, questionsByCategory] =
      await Promise.all([
        this.questionModel.aggregate([
          { $match: { organizationId: orgId } },
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ]),
        this.questionModel.aggregate([
          { $match: { organizationId: orgId } },
          { $group: { _id: '$difficulty', count: { $sum: 1 } } },
        ]),
        this.questionModel.aggregate([
          { $match: { organizationId: orgId } },
          { $group: { _id: '$category', count: { $sum: 1 } } },
        ]),
      ]);

    return {
      byType: questionsByType,
      byDifficulty: questionsByDifficulty,
      byCategory: questionsByCategory.filter(c => c._id),
    };
  }

  async getRecentActivity(organizationId: string, days: number = 7) {
    const orgId = organizationId ? new Types.ObjectId(organizationId) : null;
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    const [recentUsers, recentQuestions] = await Promise.all([
      this.userModel
        .find({ organizationIds: { $in: [orgId] }, createdAt: { $gte: dateThreshold } })
        .select('name email role createdAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .exec(),
      this.questionModel
        .find({ organizationId: orgId, createdAt: { $gte: dateThreshold } })
        .select('text type difficulty createdAt createdBy')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(10)
        .exec(),
    ]);

    return {
      recentUsers,
      recentQuestions,
      period: `${days} days`,
    };
  }

  async getUserGrowthTrend(organizationId: string, months: number = 6) {
    const orgId = organizationId ? new Types.ObjectId(organizationId) : null;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const userGrowth = await this.userModel.aggregate([
      { $match: { organizationIds: { $in: [orgId] }, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    return userGrowth;
  }
}
