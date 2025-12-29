import { connect, connection } from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { up, down } from './001-multi-exam-type-schema-migration';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runMigration(direction: 'up' | 'down' = 'up') {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;

    if (!mongoUri) {
      throw new Error('MONGODB_URI or DATABASE_URL not found in environment variables');
    }

    console.log('Connecting to MongoDB...');
    await connect(mongoUri);
    console.log('Connected successfully\n');

    if (direction === 'up') {
      console.log('Running migration UP (applying changes)...\n');
      await up(connection);
    } else {
      console.log('Running migration DOWN (rolling back changes)...\n');
      await down(connection);
    }

    console.log('\n✅ Migration completed successfully!');

    await connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    await connection.close();
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const direction = args.includes('--down') || args.includes('-d') ? 'down' : 'up';

console.log('='.repeat(60));
console.log('SkillMetric Database Migration Runner');
console.log('Migration: Multi-Exam Type Schema Updates');
console.log('='.repeat(60));
console.log();

runMigration(direction);
