import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ExamTemplate,
  ExamTemplateDocument,
} from '../schemas/exam-template.schema';
import {
  QuestionPool,
  QuestionPoolDocument,
} from '../schemas/question-pool.schema';
import {
  SystemCertification,
  SystemCertificationDocument,
} from '../schemas/system-certification.schema';
import {
  PricingPlan,
  PricingPlanDocument,
} from '../schemas/pricing-plan.schema';
import {
  CreateExamTemplateDto,
  UpdateExamTemplateDto,
} from '../dto/create-exam-template.dto';
import {
  CreateQuestionPoolDto,
  UpdateQuestionPoolDto,
} from '../dto/create-question-pool.dto';
import {
  CreateSystemCertificationDto,
  UpdateSystemCertificationDto,
} from '../dto/create-system-certification.dto';
import {
  CreatePricingPlanDto,
  UpdatePricingPlanDto,
} from '../dto/create-pricing-plan.dto';

@Injectable()
export class SystemConfigService {
  constructor(
    @InjectModel(ExamTemplate.name)
    private examTemplateModel: Model<ExamTemplateDocument>,
    @InjectModel(QuestionPool.name)
    private questionPoolModel: Model<QuestionPoolDocument>,
    @InjectModel(SystemCertification.name)
    private systemCertificationModel: Model<SystemCertificationDocument>,
    @InjectModel(PricingPlan.name)
    private pricingPlanModel: Model<PricingPlanDocument>,
  ) {}

  // ===== EXAM TEMPLATES =====
  async createExamTemplate(dto: CreateExamTemplateDto) {
    const template = new this.examTemplateModel(dto);
    return template.save();
  }

  async getAllExamTemplates(filter: any = {}) {
    return this.examTemplateModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async getExamTemplateById(id: string) {
    const template = await this.examTemplateModel.findById(id).exec();
    if (!template) {
      throw new NotFoundException('Exam template not found');
    }
    return template;
  }

  async updateExamTemplate(id: string, dto: UpdateExamTemplateDto) {
    const template = await this.examTemplateModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!template) {
      throw new NotFoundException('Exam template not found');
    }
    return template;
  }

  async deleteExamTemplate(id: string) {
    const template = await this.examTemplateModel.findByIdAndDelete(id).exec();
    if (!template) {
      throw new NotFoundException('Exam template not found');
    }
    return { message: 'Exam template deleted successfully' };
  }

  // ===== QUESTION POOLS =====
  async createQuestionPool(dto: CreateQuestionPoolDto, userId: string) {
    const pool = new this.questionPoolModel({ ...dto, createdBy: userId });
    return pool.save();
  }

  async getAllQuestionPools(filter: any = {}) {
    return this.questionPoolModel
      .find(filter)
      .populate('createdBy', 'name email')
      .populate('questions')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getQuestionPoolById(id: string) {
    const pool = await this.questionPoolModel
      .findById(id)
      .populate('createdBy', 'name email')
      .populate('questions')
      .exec();
    if (!pool) {
      throw new NotFoundException('Question pool not found');
    }
    return pool;
  }

  async updateQuestionPool(id: string, dto: UpdateQuestionPoolDto) {
    const pool = await this.questionPoolModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!pool) {
      throw new NotFoundException('Question pool not found');
    }
    return pool;
  }

  async deleteQuestionPool(id: string) {
    const pool = await this.questionPoolModel.findByIdAndDelete(id).exec();
    if (!pool) {
      throw new NotFoundException('Question pool not found');
    }
    return { message: 'Question pool deleted successfully' };
  }

  async addQuestionsToPool(poolId: string, questionIds: string[]) {
    const pool = await this.questionPoolModel.findById(poolId).exec();
    if (!pool) {
      throw new NotFoundException('Question pool not found');
    }

    // Convert string IDs to ObjectIds
    const { Types } = require('mongoose');
    const objectIds = questionIds.map(id => new Types.ObjectId(id));
    pool.questions.push(...objectIds);
    await pool.save();
    return pool;
  }

  // ===== SYSTEM CERTIFICATIONS =====
  async createSystemCertification(dto: CreateSystemCertificationDto) {
    const certification = new this.systemCertificationModel(dto);
    return certification.save();
  }

  async getAllSystemCertifications(filter: any = {}) {
    return this.systemCertificationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();
  }

  async getSystemCertificationById(id: string) {
    const certification = await this.systemCertificationModel
      .findById(id)
      .exec();
    if (!certification) {
      throw new NotFoundException('System certification not found');
    }
    return certification;
  }

  async updateSystemCertification(
    id: string,
    dto: UpdateSystemCertificationDto,
  ) {
    const certification = await this.systemCertificationModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!certification) {
      throw new NotFoundException('System certification not found');
    }
    return certification;
  }

  async deleteSystemCertification(id: string) {
    const certification = await this.systemCertificationModel
      .findByIdAndDelete(id)
      .exec();
    if (!certification) {
      throw new NotFoundException('System certification not found');
    }
    return { message: 'System certification deleted successfully' };
  }

  // ===== PRICING PLANS =====
  async createPricingPlan(dto: CreatePricingPlanDto) {
    const plan = new this.pricingPlanModel(dto);
    return plan.save();
  }

  async getAllPricingPlans(filter: any = {}) {
    return this.pricingPlanModel.find(filter).sort({ tier: 1 }).exec();
  }

  async getPricingPlanById(id: string) {
    const plan = await this.pricingPlanModel.findById(id).exec();
    if (!plan) {
      throw new NotFoundException('Pricing plan not found');
    }
    return plan;
  }

  async getPricingPlanByTier(tier: string) {
    const plan = await this.pricingPlanModel.findOne({ tier }).exec();
    if (!plan) {
      throw new NotFoundException('Pricing plan not found');
    }
    return plan;
  }

  async updatePricingPlan(id: string, dto: UpdatePricingPlanDto) {
    const plan = await this.pricingPlanModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!plan) {
      throw new NotFoundException('Pricing plan not found');
    }
    return plan;
  }

  async deletePricingPlan(id: string) {
    const plan = await this.pricingPlanModel.findByIdAndDelete(id).exec();
    if (!plan) {
      throw new NotFoundException('Pricing plan not found');
    }
    return { message: 'Pricing plan deleted successfully' };
  }

  async getPublicPricingPlans() {
    return this.pricingPlanModel
      .find({ isActive: true, isPublic: true })
      .sort({ tier: 1 })
      .exec();
  }
}
