import { connect, connection } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

// User role enum
enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORG_ADMIN = 'ORG_ADMIN',
  RECRUITER = 'RECRUITER',
  INSTRUCTOR = 'INSTRUCTOR',
  ADMIN = 'ADMIN',
  STUDENT = 'STUDENT',
  PROCTOR = 'PROCTOR',
}

// User interface
interface IUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  profile?: {
    phone?: string;
    bio?: string;
    company?: string;
    designation?: string;
  };
}

async function createRecruiterUser() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in .env file');
    }

    console.log('Connecting to MongoDB...');
    await connect(mongoUri);
    console.log('Connected to MongoDB successfully!');

    // Get the users collection
    const db = connection.db;
    const usersCollection = db.collection('users');

    // Recruiter user details
    const recruiterEmail = 'recruiter@skillmetric.com';
    const recruiterPassword = 'Recruiter@123'; // Change this to your desired password
    const recruiterName = 'John Recruiter';

    // Check if recruiter already exists
    const existingRecruiter = await usersCollection.findOne({ email: recruiterEmail });
    if (existingRecruiter) {
      console.log(`Recruiter user with email ${recruiterEmail} already exists!`);
      console.log('User details:', {
        name: existingRecruiter.name,
        email: existingRecruiter.email,
        role: existingRecruiter.role,
        isActive: existingRecruiter.isActive,
      });
      await connection.close();
      return;
    }

    // Hash the password
    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(recruiterPassword, 10);

    // Create recruiter user object
    const recruiterUser: IUser = {
      name: recruiterName,
      email: recruiterEmail,
      password: hashedPassword,
      role: UserRole.RECRUITER,
      isActive: true,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      profile: {
        phone: '+1234567890',
        bio: 'Experienced technical recruiter specializing in software engineering roles',
        company: 'SkillMetric Inc.',
        designation: 'Senior Technical Recruiter',
      },
    };

    // Insert recruiter user
    console.log('Creating recruiter user...');
    const result = await usersCollection.insertOne(recruiterUser);

    console.log('\n✅ Recruiter user created successfully!');
    console.log('='.repeat(60));
    console.log('Recruiter Login Credentials:');
    console.log('  Email:', recruiterEmail);
    console.log('  Password:', recruiterPassword);
    console.log('  Role:', UserRole.RECRUITER);
    console.log('  User ID:', result.insertedId);
    console.log('  Name:', recruiterName);
    console.log('='.repeat(60));
    console.log('\n✨ Use these credentials to login to the frontend!');
    console.log('   Frontend URL: http://localhost:3001/login');
    console.log('\n⚠️  Please save these credentials and change the password after first login!');

    // Close connection
    await connection.close();
    console.log('\nDatabase connection closed.');
  } catch (error) {
    console.error('Error creating recruiter user:', error);
    process.exit(1);
  }
}

// Run the script
createRecruiterUser();
