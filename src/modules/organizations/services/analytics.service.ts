import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Organization } from '../schemas/organization.schema';
import { User } from '../../users/schemas/user.schema';
import { Exam } from '../../exams/schemas/exam.schema';
import { Result } from '../../results/schemas/result.schema';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Organization.name)
    private organizationModel: Model<Organization>,
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Exam.name)
    private examModel: Model<Exam>,
    @InjectModel(Result.name)
    private resultModel: Model<Result>,
  ) {}

  /**
   * Get platform-wide statistics
   */
  async getPlatformStatistics() {
    const [
      totalOrganizations,
      activeOrganizations,
      totalUsers,
      totalExams,
      totalAssessments,
      organizationsByType,
      organizationsByPlan,
      organizationsByStatus,
    ] = await Promise.all([
      this.organizationModel.countDocuments(),
      this.organizationModel.countDocuments({ status: 'ACTIVE' }),
      this.userModel.countDocuments(),
      this.examModel.countDocuments(),
      this.resultModel.countDocuments(),
      this.organizationModel.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
          },
        },
      ]),
      this.organizationModel.aggregate([
        {
          $group: {
            _id: '$subscription.plan',
            count: { $sum: 1 },
          },
        },
      ]),
      this.organizationModel.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    return {
      overview: {
        totalOrganizations,
        activeOrganizations,
        suspendedOrganizations: totalOrganizations - activeOrganizations,
        totalUsers,
        totalExams,
        totalAssessments,
      },
      breakdowns: {
        byType: organizationsByType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byPlan: organizationsByPlan.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byStatus: organizationsByStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
      },
    };
  }

  /**
   * Get top organizations by various metrics
   */
  async getTopOrganizations(limit: number = 10) {
    const [byUsers, byExams, byAssessments, byCreditsUsed] = await Promise.all([
      this.organizationModel
        .find()
        .select('name stats.totalUsers')
        .sort({ 'stats.totalUsers': -1 })
        .limit(limit)
        .lean(),
      this.organizationModel
        .find()
        .select('name stats.totalExams')
        .sort({ 'stats.totalExams': -1 })
        .limit(limit)
        .lean(),
      this.organizationModel
        .find()
        .select('name stats.totalAssessments')
        .sort({ 'stats.totalAssessments': -1 })
        .limit(limit)
        .lean(),
      this.organizationModel
        .find()
        .select('name stats.creditsUsed subscription.credits')
        .sort({ 'stats.creditsUsed': -1 })
        .limit(limit)
        .lean(),
    ]);

    return {
      byUsers,
      byExams,
      byAssessments,
      byCreditsUsed,
    };
  }

  /**
   * Get system health metrics
   */
  async getSystemHealth() {
    const [
      activeUsers,
      activeExams,
      recentAssessments,
      expiringSoonOrganizations,
    ] = await Promise.all([
      this.userModel.countDocuments({
        isActive: true,
        lastLogin: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
      this.examModel.countDocuments({ status: 'ACTIVE' }),
      this.resultModel.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
      this.organizationModel.countDocuments({
        'subscription.endDate': {
          $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          $gte: new Date(),
        },
      }),
    ]);

    return {
      activeUsersLast24h: activeUsers,
      activeExams,
      assessmentsLast24h: recentAssessments,
      subscriptionsExpiringSoon: expiringSoonOrganizations,
    };
  }

  /**
   * Get revenue analytics (simplified - can be enhanced with actual pricing)
   */
  async getRevenueAnalytics() {
    const subscriptionBreakdown = await this.organizationModel.aggregate([
      {
        $match: { status: 'ACTIVE' },
      },
      {
        $group: {
          _id: '$subscription.plan',
          count: { $sum: 1 },
          totalCreditsAllocated: { $sum: '$subscription.credits' },
          totalCreditsUsed: { $sum: '$stats.creditsUsed' },
        },
      },
    ]);

    // Simple revenue estimation (you can customize this based on your pricing)
    const planPricing = {
      FREE: 0,
      BASIC: 49,
      PRO: 199,
      ENTERPRISE: 999,
    };

    const estimatedMonthlyRevenue = subscriptionBreakdown.reduce((total, plan) => {
      const price = planPricing[plan._id] || 0;
      return total + price * plan.count;
    }, 0);

    return {
      subscriptionBreakdown,
      estimatedMonthlyRevenue,
      currency: 'USD',
    };
  }

  /**
   * Get organization comparison data
   */
  async compareOrganizations(organizationIds: string[]) {
    const organizations = await this.organizationModel
      .find({ _id: { $in: organizationIds } })
      .select('name type status stats subscription')
      .lean();

    return organizations.map((org) => ({
      id: org._id,
      name: org.name,
      type: org.type,
      status: org.status,
      stats: org.stats,
      subscription: {
        plan: org.subscription.plan,
        credits: org.subscription.credits,
        creditsUsed: org.stats.creditsUsed,
        usagePercentage: (org.stats.creditsUsed / org.subscription.credits) * 100,
      },
    }));
  }
}
