import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Certification,
  CertificationSchema,
} from './schemas/certification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Certification.name, schema: CertificationSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class CertificationsModule {}
