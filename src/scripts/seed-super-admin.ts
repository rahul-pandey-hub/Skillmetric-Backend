import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';
import { User, UserRole } from '../modules/users/schemas/user.schema';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';

/**
 * Script to create a Super Admin user
 * Usage: npm run seed:super-admin
 */
async function bootstrap() {
  console.log('🚀 Starting Super Admin Seeder...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  try {
    // Check if Super Admin already exists
    const existingSuperAdmin = await userModel.findOne({ role: UserRole.SUPER_ADMIN });

    if (existingSuperAdmin) {
      console.log('⚠️  Super Admin already exists:');
      console.log(`   Email: ${existingSuperAdmin.email}`);
      console.log(`   Name: ${existingSuperAdmin.name}`);
      console.log(`   ID: ${existingSuperAdmin._id}\n`);

      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question('Do you want to create another Super Admin? (yes/no): ', (ans) => {
          rl.close();
          resolve(ans.toLowerCase().trim());
        });
      });

      if (answer !== 'yes' && answer !== 'y') {
        console.log('\n❌ Seeding cancelled.');
        await app.close();
        return;
      }
    }

    // Super Admin credentials
    const superAdminData = {
      name: process.env.SUPER_ADMIN_NAME || 'Super Admin',
      email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@skillmetric.com',
      password: process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      emailVerified: true,
    };

    // Check if email is already taken
    const existingUser = await userModel.findOne({ email: superAdminData.email });
    if (existingUser) {
      console.log(`\n❌ Error: Email ${superAdminData.email} is already in use.`);
      console.log('Please use a different email or delete the existing user.\n');
      await app.close();
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(superAdminData.password, 10);

    // Create Super Admin
    const superAdmin = new userModel({
      ...superAdminData,
      password: hashedPassword,
    });

    await superAdmin.save();

    console.log('\n✅ Super Admin created successfully!\n');
    console.log('═══════════════════════════════════════════');
    console.log('📋 Super Admin Credentials:');
    console.log('═══════════════════════════════════════════');
    console.log(`   Name:     ${superAdminData.name}`);
    console.log(`   Email:    ${superAdminData.email}`);
    console.log(`   Password: ${superAdminData.password}`);
    console.log(`   Role:     ${superAdminData.role}`);
    console.log('═══════════════════════════════════════════');
    console.log('\n⚠️  IMPORTANT: Change the password after first login!');
    console.log('⚠️  Store these credentials securely.\n');

  } catch (error) {
    console.error('\n❌ Error creating Super Admin:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  } finally {
    await app.close();
  }
}

bootstrap();
