import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORG_ADMIN = 'ORG_ADMIN',
  RECRUITER = 'RECRUITER',
  INSTRUCTOR = 'INSTRUCTOR',
  ADMIN = 'ADMIN',
  STUDENT = 'STUDENT',
  PROCTOR = 'PROCTOR',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY',
}

export enum SkillLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT',
}

export enum ProfileVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  ORGANIZATION_ONLY = 'ORGANIZATION_ONLY',
}

@Schema()
class Profile {
  @Prop()
  phone?: string;

  @Prop({ type: Date })
  dateOfBirth?: Date;

  @Prop({ type: String, enum: Object.values(Gender) })
  gender?: Gender;

  @Prop()
  profilePicture?: string;

  @Prop()
  bio?: string;

  // For students
  @Prop()
  college?: string;

  @Prop()
  university?: string;

  @Prop()
  degree?: string;

  @Prop()
  branch?: string;

  @Prop()
  graduationYear?: number;

  @Prop()
  currentYear?: number;

  @Prop()
  rollNumber?: string;

  // For professionals
  @Prop()
  company?: string;

  @Prop()
  designation?: string;

  @Prop()
  experience?: number;

  @Prop({ type: [String] })
  skills?: string[];

  @Prop()
  resume?: string;

  @Prop()
  linkedIn?: string;

  @Prop()
  github?: string;

  @Prop()
  portfolio?: string;
}

@Schema()
class SkillEntry {
  @Prop({ required: true })
  category: string;

  @Prop()
  subcategory?: string;

  @Prop({ type: String, enum: Object.values(SkillLevel) })
  level: SkillLevel;

  @Prop({ min: 0, max: 100 })
  score: number;

  @Prop({ min: 0, max: 100 })
  percentile: number;

  @Prop({ type: Date })
  lastAssessed: Date;

  @Prop({ default: 0 })
  assessmentCount: number;
}

@Schema()
class SkillProfile {
  @Prop({ type: Number, min: 0, max: 100, default: 0 })
  overallRating: number;

  @Prop({ type: Number, default: 0 })
  assessmentsTaken: number;

  @Prop({ type: [SkillEntry], default: [] })
  skills: SkillEntry[];

  @Prop({ type: [String], default: [] })
  strengths: string[];

  @Prop({ type: [String], default: [] })
  weaknesses: string[];
}

@Schema()
class Certification {
  @Prop({ type: Types.ObjectId })
  id: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop()
  badgeUrl?: string;

  @Prop()
  certificateUrl?: string;

  @Prop({ type: Date, required: true })
  issuedDate: Date;

  @Prop({ type: Date })
  expiryDate?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Exam' })
  examId?: Types.ObjectId;

  @Prop()
  score?: number;

  @Prop({ type: Boolean, default: true })
  isPublic: boolean;
}

@Schema()
class Preferences {
  @Prop({ type: Boolean, default: true })
  emailNotifications: boolean;

  @Prop({ type: Boolean, default: false })
  smsNotifications: boolean;

  @Prop({
    type: String,
    enum: Object.values(ProfileVisibility),
    default: ProfileVisibility.PRIVATE,
  })
  profileVisibility: ProfileVisibility;

  @Prop({ type: Boolean, default: true })
  showScores: boolean;

  @Prop({ default: 'en' })
  language: string;

  @Prop({ default: 'UTC' })
  timezone: string;
}

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.STUDENT })
  role: UserRole;

  @Prop({ type: Types.ObjectId, ref: 'Organization', default: null })
  organizationId?: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ unique: true, sparse: true })
  studentId?: string;

  @Prop()
  lastLogin?: Date;

  @Prop({ type: Profile, default: () => ({}) })
  profile?: Profile;

  @Prop({ type: SkillProfile, default: () => ({}) })
  skillProfile?: SkillProfile;

  @Prop({ type: [Certification], default: [] })
  certifications?: Certification[];

  @Prop({ type: Preferences, default: () => ({}) })
  preferences?: Preferences;

  @Prop()
  passwordResetToken?: string;

  @Prop({ type: Date })
  passwordResetExpires?: Date;

  @Prop({ type: Boolean, default: false })
  emailVerified: boolean;

  @Prop()
  emailVerificationToken?: string;

  // Legacy field for backward compatibility
  @Prop({ type: Object })
  metadata?: {
    phone?: string;
    department?: string;
    batch?: string;
    profilePicture?: string;
  };
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ studentId: 1 });
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ organizationId: 1, role: 1 });
UserSchema.index({ 'profile.college': 1 });
UserSchema.index({ 'profile.graduationYear': 1 });
