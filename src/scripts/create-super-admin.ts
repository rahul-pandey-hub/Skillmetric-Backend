import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';
import { User } from '../modules/users/schemas/user.schema';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';

async function createSuperAdmin() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  const superAdminEmail = 'superadmin@skillmetric.com';

  // Check if super admin already exists
  const existingAdmin = await userModel.findOne({ email: superAdminEmail });
  if (existingAdmin) {
    console.log('Super admin already exists!');
    console.log('Email:', superAdminEmail);
    await app.close();
    return;
  }

  // Create super admin
  const hashedPassword = await bcrypt.hash('SuperAdmin@123', 10);

  const superAdmin = new userModel({
    name: 'Super Admin',
    email: superAdminEmail,
    password: hashedPassword,
    role: 'SUPER_ADMIN',
    isActive: true,
    emailVerified: true,
    // No organizationId for super admin
  });

  await superAdmin.save();

  console.log('✅ Super Admin created successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Email:', superAdminEmail);
  console.log('Password: SuperAdmin@123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚠️  Please change this password after first login!');

  await app.close();
}

createSuperAdmin()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error creating super admin:', error);
    process.exit(1);
  });
