import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Exam } from '../../exams/schemas/exam.schema';
import { Result } from '../../results/schemas/result.schema';

@Injectable()
export class ShortlistingService {
  constructor(
    @InjectModel(Exam.name) private examModel: Model<Exam>,
    @InjectModel(Result.name) private resultModel: Model<Result>,
  ) {}

  async executeAutoShortlisting(examId: string): Promise<{
    totalCandidates: number;
    shortlisted: number;
    shortlistingRate: number;
    criteria: any;
  }> {
    // Fetch exam with shortlisting criteria
    const exam = await this.examModel.findById(examId);

    if (!exam) {
      throw new NotFoundException(`Exam with ID ${examId} not found`);
    }

    if (!exam.shortlistingCriteria?.enabled) {
      throw new Error('Shortlisting is not enabled for this exam');
    }

    // Fetch all results for the exam
    const results = await this.resultModel.find({
      exam: examId,
      status: { $in: ['EVALUATED', 'PUBLISHED'] },
    }).sort({ 'scoring.totalScore': -1 });

    if (results.length === 0) {
      return {
        totalCandidates: 0,
        shortlisted: 0,
        shortlistingRate: 0,
        criteria: exam.shortlistingCriteria,
      };
    }

    const { shortlistingCriteria } = exam;
    let shortlistedCount = 0;

    for (const result of results) {
      const isShortlisted = this.checkShortlistingCriteria(
        result,
        shortlistingCriteria,
        results,
      );

      if (isShortlisted) {
        await this.resultModel.findByIdAndUpdate(result._id, {
          $set: {
            shortlisted: true,
            shortlistingReason: this.buildShortlistingReason(
              result,
              shortlistingCriteria,
            ),
          },
        });
        shortlistedCount++;
      } else {
        await this.resultModel.findByIdAndUpdate(result._id, {
          $set: {
            shortlisted: false,
            shortlistingReason: null,
          },
        });
      }
    }

    const shortlistingRate = (shortlistedCount / results.length) * 100;

    return {
      totalCandidates: results.length,
      shortlisted: shortlistedCount,
      shortlistingRate,
      criteria: shortlistingCriteria,
    };
  }

  private checkShortlistingCriteria(
    result: any,
    criteria: any,
    allResults: any[],
  ): boolean {
    let meetsAllCriteria = true;

    // Check minimum score
    if (
      criteria.minimumScore &&
      result.scoring.totalScore < criteria.minimumScore
    ) {
      meetsAllCriteria = false;
    }

    // Check minimum percentage
    if (
      criteria.minimumPercentage &&
      result.scoring.percentage < criteria.minimumPercentage
    ) {
      meetsAllCriteria = false;
    }

    // Check percentile threshold
    if (
      criteria.percentileThreshold &&
      result.ranking.percentile < criteria.percentileThreshold
    ) {
      meetsAllCriteria = false;
    }

    // Check top N candidates
    if (criteria.autoAdvanceTopN) {
      const rank = result.ranking.rank || 0;
      if (rank > criteria.autoAdvanceTopN) {
        meetsAllCriteria = false;
      }
    }

    // Check top percentage
    if (criteria.autoAdvanceTopPercent) {
      const percentile = result.ranking.percentile || 0;
      if (percentile < (100 - criteria.autoAdvanceTopPercent)) {
        meetsAllCriteria = false;
      }
    }

    // Check section-wise cutoffs
    if (
      criteria.sectionWiseCutoff &&
      criteria.sectionWiseCutoff.length > 0
    ) {
      for (const sectionCutoff of criteria.sectionWiseCutoff) {
        const categoryScore = result.categoryWiseScore?.find(
          (cs: any) => cs.category === sectionCutoff.category,
        );

        if (!categoryScore || categoryScore.score < sectionCutoff.minimumScore) {
          meetsAllCriteria = false;
          break;
        }
      }
    }

    return meetsAllCriteria;
  }

  private buildShortlistingReason(result: any, criteria: any): string {
    const reasons: string[] = [];

    if (criteria.percentileThreshold) {
      reasons.push(
        `Percentile ${result.ranking.percentile} >= threshold ${criteria.percentileThreshold}`,
      );
    }

    if (criteria.minimumScore) {
      reasons.push(
        `Score ${result.scoring.totalScore} >= minimum ${criteria.minimumScore}`,
      );
    }

    if (criteria.minimumPercentage) {
      reasons.push(
        `Percentage ${result.scoring.percentage} >= minimum ${criteria.minimumPercentage}`,
      );
    }

    if (criteria.autoAdvanceTopN) {
      reasons.push(`Rank ${result.ranking.rank} within top ${criteria.autoAdvanceTopN}`);
    }

    if (criteria.sectionWiseCutoff && criteria.sectionWiseCutoff.length > 0) {
      reasons.push('All section cutoffs met');
    }

    return reasons.join(', ');
  }

  async getShortlistedCandidates(examId: string): Promise<any[]> {
    const results = await this.resultModel
      .find({
        exam: examId,
        shortlisted: true,
        status: { $in: ['EVALUATED', 'PUBLISHED'] },
      })
      .populate('student', 'name email profile')
      .sort({ 'scoring.totalScore': -1 });

    return results;
  }
}
