import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Result } from '../../results/schemas/result.schema';
import { Exam } from '../../exams/schemas/exam.schema';
import { User } from '../../users/schemas/user.schema';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);
  private readonly certificatesDir = path.join(process.cwd(), 'certificates');

  constructor(
    @InjectModel(Result.name) private resultModel: Model<Result>,
    @InjectModel(Exam.name) private examModel: Model<Exam>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {
    // Ensure certificates directory exists
    if (!fs.existsSync(this.certificatesDir)) {
      fs.mkdirSync(this.certificatesDir, { recursive: true });
    }
  }

  /**
   * Generate certificate for a result
   */
  async generateCertificate(resultId: string): Promise<string> {
    // Fetch result with populated data
    const result = await this.resultModel
      .findById(resultId)
      .populate('candidate')
      .populate('exam')
      .exec();

    if (!result) {
      throw new NotFoundException('Result not found');
    }

    // Check if student passed
    if (!result.score?.passed) {
      throw new Error('Certificate can only be generated for passed students');
    }

    // Check if certificate already exists
    if (result.certificate?.certificateUrl) {
      this.logger.log(`Certificate already exists for result ${resultId}`);
      return result.certificate.certificateUrl;
    }

    const candidate = result.candidate as any;
    const exam = result.exam as any;

    // Generate certificate ID
    const certificateId = `CERT-${Date.now()}-${result._id.toString().slice(-6).toUpperCase()}`;

    // Generate PDF
    const filename = `${certificateId}.pdf`;
    const filepath = path.join(this.certificatesDir, filename);

    await this.createCertificatePDF({
      filepath,
      certificateId,
      studentName: candidate.name,
      examTitle: exam.title,
      score: result.score.obtained,
      totalMarks: result.score.total,
      percentage: result.score.percentage,
      completionDate: result.publishedAt || result.submittedAt || new Date(),
      rank: result.rank,
    });

    // Update result with certificate info
    result.certificate = {
      generated: true,
      certificateId,
      certificateUrl: `/certificates/${filename}`,
      generatedAt: new Date(),
    };

    await result.save();

    this.logger.log(`Certificate generated successfully: ${certificateId}`);
    return result.certificate.certificateUrl;
  }

  /**
   * Generate certificates for all passed candidates in an exam
   */
  async generateCertificatesForExam(examId: string): Promise<{
    generated: number;
    skipped: number;
    failed: number;
  }> {
    const results = await this.resultModel
      .find({
        exam: examId,
        'score.passed': true,
      })
      .populate('candidate')
      .populate('exam')
      .exec();

    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (const result of results) {
      try {
        if (result.certificate?.generated) {
          skipped++;
          continue;
        }

        await this.generateCertificate(result._id.toString());
        generated++;
      } catch (error) {
        this.logger.error(
          `Failed to generate certificate for result ${result._id}:`,
          error,
        );
        failed++;
      }
    }

    this.logger.log(
      `Certificate generation completed for exam ${examId}: ` +
      `${generated} generated, ${skipped} skipped, ${failed} failed`,
    );

    return { generated, skipped, failed };
  }

  /**
   * Create PDF certificate
   */
  private async createCertificatePDF(data: {
    filepath: string;
    certificateId: string;
    studentName: string;
    examTitle: string;
    score: number;
    totalMarks: number;
    percentage: number;
    completionDate: Date;
    rank?: number;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          layout: 'landscape',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
        });

        const stream = fs.createWriteStream(data.filepath);
        doc.pipe(stream);

        // Certificate border
        doc
          .lineWidth(10)
          .strokeColor('#2563eb')
          .rect(20, 20, doc.page.width - 40, doc.page.height - 40)
          .stroke();

        doc
          .lineWidth(2)
          .strokeColor('#60a5fa')
          .rect(30, 30, doc.page.width - 60, doc.page.height - 60)
          .stroke();

        // Header
        doc
          .fontSize(48)
          .font('Helvetica-Bold')
          .fillColor('#1e40af')
          .text('CERTIFICATE', 50, 80, {
            align: 'center',
            width: doc.page.width - 100,
          });

        doc
          .fontSize(20)
          .font('Helvetica')
          .fillColor('#64748b')
          .text('OF ACHIEVEMENT', 50, 140, {
            align: 'center',
            width: doc.page.width - 100,
          });

        // Decorative line
        doc
          .moveTo(200, 180)
          .lineTo(doc.page.width - 200, 180)
          .strokeColor('#93c5fd')
          .lineWidth(2)
          .stroke();

        // "This is to certify that"
        doc
          .fontSize(16)
          .font('Helvetica')
          .fillColor('#475569')
          .text('This is to certify that', 50, 220, {
            align: 'center',
            width: doc.page.width - 100,
          });

        // Student name
        doc
          .fontSize(36)
          .font('Helvetica-Bold')
          .fillColor('#0f172a')
          .text(data.studentName, 50, 260, {
            align: 'center',
            width: doc.page.width - 100,
          });

        // Underline for name
        const nameY = 300;
        doc
          .moveTo(150, nameY)
          .lineTo(doc.page.width - 150, nameY)
          .strokeColor('#cbd5e1')
          .lineWidth(1)
          .stroke();

        // Achievement text
        doc
          .fontSize(16)
          .font('Helvetica')
          .fillColor('#475569')
          .text('has successfully completed', 50, nameY + 20, {
            align: 'center',
            width: doc.page.width - 100,
          });

        // Exam title
        doc
          .fontSize(24)
          .font('Helvetica-Bold')
          .fillColor('#1e40af')
          .text(data.examTitle, 50, nameY + 55, {
            align: 'center',
            width: doc.page.width - 100,
          });

        // Score box
        const scoreBoxY = nameY + 110;
        doc
          .roundedRect(doc.page.width / 2 - 150, scoreBoxY, 300, 60, 8)
          .fillColor('#eff6ff')
          .fill();

        doc
          .fontSize(14)
          .font('Helvetica')
          .fillColor('#64748b')
          .text('Score', doc.page.width / 2 - 100, scoreBoxY + 10, {
            width: 200,
            align: 'center',
          });

        doc
          .fontSize(24)
          .font('Helvetica-Bold')
          .fillColor('#1e40af')
          .text(
            `${data.score}/${data.totalMarks} (${data.percentage.toFixed(1)}%)`,
            doc.page.width / 2 - 100,
            scoreBoxY + 30,
            {
              width: 200,
              align: 'center',
            },
          );

        // Rank (if available)
        if (data.rank) {
          doc
            .fontSize(12)
            .font('Helvetica-Bold')
            .fillColor('#059669')
            .text(`Rank: #${data.rank}`, 50, scoreBoxY + 70, {
              align: 'center',
              width: doc.page.width - 100,
            });
        }

        // Date and Certificate ID
        const bottomY = doc.page.height - 120;
        const dateStr = new Date(data.completionDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        // Left side - Date
        doc
          .fontSize(12)
          .font('Helvetica')
          .fillColor('#64748b')
          .text('Date of Completion', 100, bottomY, {
            width: 200,
            align: 'center',
          });

        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .fillColor('#0f172a')
          .text(dateStr, 100, bottomY + 20, {
            width: 200,
            align: 'center',
          });

        // Signature line
        doc
          .moveTo(120, bottomY + 45)
          .lineTo(280, bottomY + 45)
          .strokeColor('#cbd5e1')
          .lineWidth(1)
          .stroke();

        // Right side - Certificate ID
        doc
          .fontSize(12)
          .font('Helvetica')
          .fillColor('#64748b')
          .text('Certificate ID', doc.page.width - 300, bottomY, {
            width: 200,
            align: 'center',
          });

        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .fillColor('#0f172a')
          .text(data.certificateId, doc.page.width - 300, bottomY + 20, {
            width: 200,
            align: 'center',
          });

        // Authorized signature line
        doc
          .moveTo(doc.page.width - 280, bottomY + 45)
          .lineTo(doc.page.width - 120, bottomY + 45)
          .strokeColor('#cbd5e1')
          .lineWidth(1)
          .stroke();

        doc
          .fontSize(10)
          .font('Helvetica-Oblique')
          .fillColor('#94a3b8')
          .text('Authorized Signature', doc.page.width - 280, bottomY + 50, {
            width: 160,
            align: 'center',
          });

        // Footer - SkillMetric branding
        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#cbd5e1')
          .text(
            'Powered by SkillMetric | Verify at skillmetric.com/verify',
            50,
            doc.page.height - 40,
            {
              align: 'center',
              width: doc.page.width - 100,
            },
          );

        // Finalize PDF
        doc.end();

        stream.on('finish', () => {
          this.logger.log(`PDF created successfully: ${data.filepath}`);
          resolve();
        });

        stream.on('error', (error) => {
          this.logger.error(`Failed to create PDF: ${error.message}`);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get certificate by result ID
   */
  async getCertificateUrl(resultId: string): Promise<string> {
    const result = await this.resultModel.findById(resultId).exec();

    if (!result) {
      throw new NotFoundException('Result not found');
    }

    if (!result.certificate?.certificateUrl) {
      // Try to generate if not exists
      return await this.generateCertificate(resultId);
    }

    return result.certificate.certificateUrl;
  }
}
