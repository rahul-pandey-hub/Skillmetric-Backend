import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Organization } from '../../organizations/schemas/organization.schema';
import { UpdateOrgSettingsDto } from '../dto/org-settings.dto';

@Injectable()
export class OrgSettingsService {
  constructor(
    @InjectModel(Organization.name) private organizationModel: Model<Organization>,
  ) {}

  async getOrganizationSettings(organizationId: string) {
    const organization = await this.organizationModel
      .findById(organizationId)
      .select('name type status contactInfo subscription features branding stats')
      .exec();

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async updateOrganizationSettings(
    organizationId: string,
    dto: UpdateOrgSettingsDto,
  ) {
    const updateData: any = {};

    if (dto.name) {
      updateData.name = dto.name;
    }

    if (dto.contactInfo) {
      // Merge contact info
      if (dto.contactInfo.email) updateData['contactInfo.email'] = dto.contactInfo.email;
      if (dto.contactInfo.phone) updateData['contactInfo.phone'] = dto.contactInfo.phone;
      if (dto.contactInfo.website) updateData['contactInfo.website'] = dto.contactInfo.website;

      if (dto.contactInfo.address) {
        if (dto.contactInfo.address.street) updateData['contactInfo.address.street'] = dto.contactInfo.address.street;
        if (dto.contactInfo.address.city) updateData['contactInfo.address.city'] = dto.contactInfo.address.city;
        if (dto.contactInfo.address.state) updateData['contactInfo.address.state'] = dto.contactInfo.address.state;
        if (dto.contactInfo.address.country) updateData['contactInfo.address.country'] = dto.contactInfo.address.country;
        if (dto.contactInfo.address.pincode) updateData['contactInfo.address.pincode'] = dto.contactInfo.address.pincode;
      }
    }

    if (dto.features) {
      Object.keys(dto.features).forEach(key => {
        updateData[`features.${key}`] = dto.features[key];
      });
    }

    if (dto.branding) {
      Object.keys(dto.branding).forEach(key => {
        updateData[`branding.${key}`] = dto.branding[key];
      });
    }

    const organization = await this.organizationModel
      .findByIdAndUpdate(
        organizationId,
        { $set: updateData },
        { new: true },
      )
      .select('name type status contactInfo subscription features branding stats')
      .exec();

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async getOrganizationUsage(organizationId: string) {
    const organization = await this.organizationModel
      .findById(organizationId)
      .select('subscription stats')
      .exec();

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const usagePercentages = {
      credits: organization.subscription.credits > 0
        ? (organization.stats.creditsUsed / organization.subscription.credits) * 100
        : 0,
      users: organization.subscription.maxConcurrentUsers > 0
        ? (organization.stats.totalUsers / organization.subscription.maxConcurrentUsers) * 100
        : 0,
      exams: organization.subscription.maxExamsPerMonth > 0
        ? (organization.stats.totalExams / organization.subscription.maxExamsPerMonth) * 100
        : 0,
    };

    return {
      subscription: organization.subscription,
      stats: organization.stats,
      usage: usagePercentages,
    };
  }
}
