import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Question } from '../../questions/schemas/question.schema';
import { CreateQuestionDto, UpdateQuestionDto, QuestionFiltersDto } from '../dto/create-question.dto';

@Injectable()
export class QuestionManagementService {
  constructor(
    @InjectModel(Question.name) private questionModel: Model<Question>,
  ) {}

  async createQuestion(dto: CreateQuestionDto, organizationId: string, userId: string) {
    const question = new this.questionModel({
      ...dto,
      organizationId,
      createdBy: userId,
      isActive: dto.isActive ?? true,
      isPublic: dto.isPublic ?? false,
    });

    await question.save();
    return question;
  }

  async bulkCreateQuestions(questions: CreateQuestionDto[], organizationId: string, userId: string) {
    const results = {
      success: [],
      failed: [],
    };

    for (const questionDto of questions) {
      try {
        const question = await this.createQuestion(questionDto, organizationId, userId);
        results.success.push({
          text: questionDto.text.substring(0, 50) + '...',
          id: question._id,
        });
      } catch (error) {
        results.failed.push({
          text: questionDto.text.substring(0, 50) + '...',
          error: error.message,
        });
      }
    }

    return results;
  }

  async getAllQuestions(filters: QuestionFiltersDto, organizationId: string) {
    const { type, difficulty, category, search, tags, page = 1, limit = 10 } = filters;

    const query: any = { organizationId };

    if (type) query.type = type;
    if (difficulty) query.difficulty = difficulty;
    if (category) query.category = category;
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }
    if (search) {
      query.$or = [
        { text: { $regex: search, $options: 'i' } },
        { topic: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [questions, total] = await Promise.all([
      this.questionModel
        .find(query)
        .select('-correctAnswer -codingDetails.testCases')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.questionModel.countDocuments(query),
    ]);

    return {
      data: questions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getQuestionById(id: string, organizationId: string) {
    const question = await this.questionModel
      .findOne({ _id: id, organizationId })
      .populate('createdBy', 'name email')
      .exec();

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    return question;
  }

  async updateQuestion(id: string, dto: UpdateQuestionDto, organizationId: string) {
    const question = await this.questionModel
      .findOneAndUpdate(
        { _id: id, organizationId },
        { $set: dto },
        { new: true },
      )
      .exec();

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    return question;
  }

  async deleteQuestion(id: string, organizationId: string) {
    const question = await this.questionModel.findOneAndDelete({
      _id: id,
      organizationId,
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    return { message: 'Question deleted successfully' };
  }

  async toggleQuestionStatus(id: string, organizationId: string) {
    const question = await this.questionModel.findOne({ _id: id, organizationId });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    question.isActive = !question.isActive;
    await question.save();

    return {
      message: `Question ${question.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: question.isActive,
    };
  }

  async getQuestionStatistics(organizationId: string) {
    const [
      totalQuestions,
      questionsByType,
      questionsByDifficulty,
      questionsByCategory,
    ] = await Promise.all([
      this.questionModel.countDocuments({ organizationId }),
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
      total: totalQuestions,
      byType: questionsByType,
      byDifficulty: questionsByDifficulty,
      byCategory: questionsByCategory,
    };
  }
}
