import { connect, connection } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

async function resetPassword() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);

    if (args.length < 2) {
      console.error('Usage: ts-node reset-password.ts <email> <new-password>');
      console.error('Example: ts-node reset-password.ts admin@skillmetric.com NewPassword123');
      process.exit(1);
    }

    const userEmail = args[0];
    const newPassword = args[1];

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

    // Check if user exists
    const existingUser = await usersCollection.findOne({ email: userEmail });
    if (!existingUser) {
      console.error(`❌ User with email ${userEmail} does not exist!`);
      await connection.close();
      process.exit(1);
    }

    console.log('User found:', {
      name: existingUser.name,
      email: existingUser.email,
      role: existingUser.role,
      isActive: existingUser.isActive,
    });

    // Hash the new password
    console.log('\nHashing new password...');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password
    console.log('Updating password...');
    await usersCollection.updateOne(
      { email: userEmail },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date()
        }
      }
    );

    console.log('\n✅ Password reset successfully!');
    console.log('='.repeat(50));
    console.log('Updated Login Credentials:');
    console.log('  Email:', userEmail);
    console.log('  New Password:', newPassword);
    console.log('  Role:', existingUser.role);
    console.log('='.repeat(50));
    console.log('\n⚠️  Please save these credentials securely!');

    // Close connection
    await connection.close();
    console.log('\nDatabase connection closed.');
  } catch (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  }
}

// Run the script
resetPassword();
