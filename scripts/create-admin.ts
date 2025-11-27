import { connect, connection } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

// User role enum
enum UserRole {
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
  createdAt: Date;
  updatedAt: Date;
}

async function createAdminUser() {
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

    // Admin user details
    const adminEmail = 'admin@skillmetric.com';
    const adminPassword = 'Admin@123'; // Change this to your desired password
    const adminName = 'Admin User';

    // Check if admin already exists
    const existingAdmin = await usersCollection.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log(`Admin user with email ${adminEmail} already exists!`);
      console.log('User details:', {
        name: existingAdmin.name,
        email: existingAdmin.email,
        role: existingAdmin.role,
        isActive: existingAdmin.isActive,
      });
      await connection.close();
      return;
    }

    // Hash the password
    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Create admin user object
    const adminUser: IUser = {
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      role: UserRole.ADMIN,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Insert admin user
    console.log('Creating admin user...');
    const result = await usersCollection.insertOne(adminUser);

    console.log('\n✅ Admin user created successfully!');
    console.log('='.repeat(50));
    console.log('Admin Login Credentials:');
    console.log('  Email:', adminEmail);
    console.log('  Password:', adminPassword);
    console.log('  Role:', UserRole.ADMIN);
    console.log('  User ID:', result.insertedId);
    console.log('='.repeat(50));
    console.log('\n⚠️  Please save these credentials and change the password after first login!');

    // Close connection
    await connection.close();
    console.log('\nDatabase connection closed.');
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

// Run the script
createAdminUser();
