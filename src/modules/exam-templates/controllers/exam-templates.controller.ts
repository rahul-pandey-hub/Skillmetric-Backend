import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CreateExamTemplateDto } from '../dto/create-exam-template.dto';
import { UpdateExamTemplateDto } from '../dto/update-exam-template.dto';
import { CreateExamTemplateCommand } from '../commands/impl/create-exam-template.command';
import {
  ExamTemplate,
  ExamTemplateDocument,
} from '../schemas/exam-template.schema';

@Controller('exam-templates')
@UseGuards(JwtAuthGuard)
export class ExamTemplatesController {
  constructor(
    private readonly commandBus: CommandBus,
    @InjectModel(ExamTemplate.name)
    private examTemplateModel: Model<ExamTemplateDocument>,
  ) {}

  @Post()
  async create(
    @Body() createExamTemplateDto: CreateExamTemplateDto,
    @Request() req,
  ) {
    const template = await this.commandBus.execute(
      new CreateExamTemplateCommand(createExamTemplateDto, req.user.userId),
    );

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Exam template created successfully',
      data: template,
    };
  }

  @Get()
  async findAll(
    @Query('category') category?: string,
    @Query('targetLevel') targetLevel?: string,
    @Query('isPublic') isPublic?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const query: any = { isActive: true };
    if (category) query.category = category;
    if (targetLevel) query.targetLevel = targetLevel;
    if (isPublic !== undefined) query.isPublic = isPublic === 'true';

    const skip = (page - 1) * limit;

    const [templates, total] = await Promise.all([
      this.examTemplateModel
        .find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .populate('createdBy', 'name email')
        .exec(),
      this.examTemplateModel.countDocuments(query),
    ]);

    return {
      statusCode: HttpStatus.OK,
      data: templates,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const template = await this.examTemplateModel
      .findById(id)
      .populate('createdBy', 'name email')
      .exec();

    if (!template) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Exam template not found',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      data: template,
    };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateExamTemplateDto: UpdateExamTemplateDto,
  ) {
    const template = await this.examTemplateModel.findByIdAndUpdate(
      id,
      { $set: updateExamTemplateDto },
      { new: true, runValidators: true },
    );

    if (!template) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Exam template not found',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Exam template updated successfully',
      data: template,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const template = await this.examTemplateModel.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true },
    );

    if (!template) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Exam template not found',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Exam template deleted successfully',
    };
  }
}
