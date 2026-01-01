import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';
import { Organization } from '../modules/organizations/schemas/organization.schema';
import { User, UserRole } from '../modules/users/schemas/user.schema';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';

/**
 * Script to seed test data for super admin dashboard
 * Usage: npm run seed:test-data
 */
async function bootstrap() {
  console.log('🚀 Starting Test Data Seeder...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const organizationModel = app.get<Model<Organization>>(getModelToken(Organization.name));
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  try {
    // Sample organizations data
    const testOrganizations = [
      {
        name: 'TechCorp Solutions',
        type: 'COMPANY',
        status: 'ACTIVE',
        contactInfo: {
          email: 'contact@techcorp.com',
          phone: '+1-555-0101',
          website: 'https://techcorp.com',
          address: {
            street: '123 Tech Street',
            city: 'San Francisco',
            state: 'CA',
            country: 'USA',
            pincode: '94105',
          },
        },
        subscription: {
          plan: 'PRO',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          credits: 50000,
          maxConcurrentUsers: 2000,
          maxExamsPerMonth: 100,
        },
        features: {
          brandingEnabled: true,
          customEmailTemplates: true,
          advancedProctoring: true,
          apiAccess: true,
          bulkOperations: true,
          analyticsExport: true,
        },
        stats: {
          totalUsers: 1250,
          totalExams: 45,
          totalAssessments: 3890,
          creditsUsed: 12500,
        },
      },
      {
        name: 'Stanford University',
        type: 'UNIVERSITY',
        status: 'ACTIVE',
        contactInfo: {
          email: 'admin@stanford.edu',
          phone: '+1-555-0102',
          website: 'https://stanford.edu',
          address: {
            street: '450 Serra Mall',
            city: 'Stanford',
            state: 'CA',
            country: 'USA',
            pincode: '94305',
          },
        },
        subscription: {
          plan: 'ENTERPRISE',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          credits: 100000,
          maxConcurrentUsers: 5000,
          maxExamsPerMonth: 500,
        },
        features: {
          brandingEnabled: true,
          customEmailTemplates: true,
          advancedProctoring: true,
          apiAccess: true,
          bulkOperations: true,
          analyticsExport: true,
        },
        stats: {
          totalUsers: 4500,
          totalExams: 120,
          totalAssessments: 15600,
          creditsUsed: 45000,
        },
      },
      {
        name: 'Digital Skills Academy',
        type: 'TRAINING_INSTITUTE',
        status: 'ACTIVE',
        contactInfo: {
          email: 'info@digitalskills.com',
          phone: '+1-555-0103',
          website: 'https://digitalskills.com',
          address: {
            street: '789 Learning Ave',
            city: 'Austin',
            state: 'TX',
            country: 'USA',
            pincode: '78701',
          },
        },
        subscription: {
          plan: 'BASIC',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          credits: 10000,
          maxConcurrentUsers: 500,
          maxExamsPerMonth: 50,
        },
        features: {
          brandingEnabled: false,
          customEmailTemplates: false,
          advancedProctoring: true,
          apiAccess: false,
          bulkOperations: false,
          analyticsExport: false,
        },
        stats: {
          totalUsers: 350,
          totalExams: 28,
          totalAssessments: 1890,
          creditsUsed: 4200,
        },
      },
      {
        name: 'Global HR Consultants',
        type: 'COMPANY',
        status: 'ACTIVE',
        contactInfo: {
          email: 'hr@globalhr.com',
          phone: '+1-555-0104',
          website: 'https://globalhr.com',
          address: {
            street: '456 Business Blvd',
            city: 'New York',
            state: 'NY',
            country: 'USA',
            pincode: '10001',
          },
        },
        subscription: {
          plan: 'PRO',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          credits: 50000,
          maxConcurrentUsers: 2000,
          maxExamsPerMonth: 100,
        },
        features: {
          brandingEnabled: true,
          customEmailTemplates: false,
          advancedProctoring: true,
          apiAccess: true,
          bulkOperations: true,
          analyticsExport: true,
        },
        stats: {
          totalUsers: 890,
          totalExams: 65,
          totalAssessments: 5670,
          creditsUsed: 18900,
        },
      },
      {
        name: 'Startup Incubator',
        type: 'COMPANY',
        status: 'TRIAL',
        contactInfo: {
          email: 'team@startupinc.com',
          phone: '+1-555-0105',
          website: 'https://startupinc.com',
          address: {
            street: '321 Innovation Dr',
            city: 'Seattle',
            state: 'WA',
            country: 'USA',
            pincode: '98101',
          },
        },
        subscription: {
          plan: 'FREE',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          credits: 1000,
          maxConcurrentUsers: 100,
          maxExamsPerMonth: 10,
        },
        features: {
          brandingEnabled: false,
          customEmailTemplates: false,
          advancedProctoring: false,
          apiAccess: false,
          bulkOperations: false,
          analyticsExport: false,
        },
        stats: {
          totalUsers: 45,
          totalExams: 5,
          totalAssessments: 120,
          creditsUsed: 250,
        },
      },
      {
        name: 'MIT OpenCourseWare',
        type: 'UNIVERSITY',
        status: 'ACTIVE',
        contactInfo: {
          email: 'ocw@mit.edu',
          phone: '+1-555-0106',
          website: 'https://ocw.mit.edu',
          address: {
            street: '77 Massachusetts Ave',
            city: 'Cambridge',
            state: 'MA',
            country: 'USA',
            pincode: '02139',
          },
        },
        subscription: {
          plan: 'ENTERPRISE',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          credits: 100000,
          maxConcurrentUsers: 5000,
          maxExamsPerMonth: 500,
        },
        features: {
          brandingEnabled: true,
          customEmailTemplates: true,
          advancedProctoring: true,
          apiAccess: true,
          bulkOperations: true,
          analyticsExport: true,
        },
        stats: {
          totalUsers: 6800,
          totalExams: 200,
          totalAssessments: 28900,
          creditsUsed: 65000,
        },
      },
    ];

    console.log('📊 Creating test organizations...\n');

    for (const orgData of testOrganizations) {
      // Check if organization already exists
      const existing = await organizationModel.findOne({
        'contactInfo.email': orgData.contactInfo.email,
      });

      if (existing) {
        console.log(`⏭️  Skipping ${orgData.name} - already exists`);
        continue;
      }

      const org = new organizationModel(orgData);
      await org.save();
      console.log(`✅ Created: ${orgData.name} (${orgData.type}, ${orgData.subscription.plan})`);

      // Create an admin user for each organization
      const hashedPassword = await bcrypt.hash('Admin@123', 10);
      const adminEmail = `admin@${orgData.contactInfo.email.split('@')[1]}`;

      const existingAdmin = await userModel.findOne({ email: adminEmail });
      if (!existingAdmin) {
        const admin = new userModel({
          name: `${orgData.name} Admin`,
          email: adminEmail,
          password: hashedPassword,
          role: UserRole.ORG_ADMIN,
          organizationId: org._id,
          isActive: true,
          emailVerified: true,
        });
        await admin.save();

        // Add admin to organization
        org.admins.push(admin._id as any);
        await org.save();

        console.log(`   👤 Created admin: ${adminEmail}`);
      }
    }

    // Create some additional users for statistics
    console.log('\n👥 Creating additional test users...\n');

    const organizations = await organizationModel.find().limit(3);
    const password = await bcrypt.hash('User@123', 10);

    for (const org of organizations) {
      const userCount = Math.floor(Math.random() * 10) + 5; // 5-15 users per org

      for (let i = 0; i < userCount; i++) {
        const userEmail = `user${i + 1}@${org.contactInfo.email.split('@')[1]}`;
        const existingUser = await userModel.findOne({ email: userEmail });

        if (!existingUser) {
          const user = new userModel({
            name: `Test User ${i + 1}`,
            email: userEmail,
            password,
            role: UserRole.CANDIDATE,
            organizationId: org._id,
            isActive: true,
            emailVerified: true,
          });
          await user.save();
        }
      }

      console.log(`✅ Created ${userCount} users for ${org.name}`);
    }

    console.log('\n═══════════════════════════════════════════');
    console.log('✅ Test Data Seeded Successfully!');
    console.log('═══════════════════════════════════════════');
    console.log('\n📋 Summary:');
    console.log(`   Organizations: ${testOrganizations.length}`);
    console.log(`   Users: Check database for full count`);
    console.log('\n🔐 Default Credentials:');
    console.log('   Super Admin: superadmin@skillmetric.com / SuperAdmin@123');
    console.log('   Org Admins: admin@[domain] / Admin@123');
    console.log('   Users: user[N]@[domain] / User@123');
    console.log('\n⚠️  This is test data for development only!');
    console.log('   Do not use in production.\n');

  } catch (error) {
    console.error('\n❌ Error seeding test data:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  } finally {
    await app.close();
  }
}

bootstrap();
