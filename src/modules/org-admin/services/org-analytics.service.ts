import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Question } from '../../questions/schemas/question.schema';

@Injectable()
export class OrgAnalyticsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Question.name) private questionModel: Model<Question>,
  ) {}

  async getOrganizationStats(organizationId: string) {
    const [
      totalUsers,
      activeUsers,
      totalQuestions,
      activeQuestions,
      usersByRole,
      usersByDepartment,
    ] = await Promise.all([
      this.userModel.countDocuments({ organizationId }),
      this.userModel.countDocuments({ organizationId, isActive: true }),
      this.questionModel.countDocuments({ organizationId }),
      this.questionModel.countDocuments({ organizationId, isActive: true }),
      this.userModel.aggregate([
        { $match: { organizationId } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      this.userModel.aggregate([
        { $match: { organizationId } },
        { $group: { _id: '$metadata.department', count: { $sum: 1 } } },
      ]),
    ]);

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
    const departmentStats = await this.userModel.aggregate([
      { $match: { organizationId } },
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
    const batchStats = await this.userModel.aggregate([
      { $match: { organizationId } },
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
    const [questionsByType, questionsByDifficulty, questionsByCategory] =
      await Promise.all([
        this.questionModel.aggregate([
          { $match: { organizationId } },
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ]),
        this.questionModel.aggregate([
          { $match: { organizationId } },
          { $group: { _id: '$difficulty', count: { $sum: 1 } } },
        ]),
        this.questionModel.aggregate([
          { $match: { organizationId } },
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
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    const [recentUsers, recentQuestions] = await Promise.all([
      this.userModel
        .find({ organizationId, createdAt: { $gte: dateThreshold } })
        .select('name email role createdAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .exec(),
      this.questionModel
        .find({ organizationId, createdAt: { $gte: dateThreshold } })
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
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const userGrowth = await this.userModel.aggregate([
      { $match: { organizationId, createdAt: { $gte: startDate } } },
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
