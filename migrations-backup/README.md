# Database Migrations

This directory contains database migration scripts for SkillMetric.

## Available Migrations

### 001-multi-exam-type-schema-migration.ts

**Purpose**: Add support for three exam types and simplify user roles

**Changes**:
- Adds `ExamCategory` and `ExamAccessMode` to Exam schema
- Migrates deprecated user roles (INSTRUCTOR, ADMIN, STUDENT, PROCTOR) to new simplified roles
- Adds invitation support fields to ExamSession and Result schemas
- Creates new indexes for improved query performance
- Adds backward compatibility fields

## Running Migrations

### Apply Migration (UP)

```bash
# From backend directory
npx ts-node src/migrations/run-migration.ts

# Or explicitly specify up
npx ts-node src/migrations/run-migration.ts --up
```

### Rollback Migration (DOWN)

```bash
# From backend directory
npx ts-node src/migrations/run-migration.ts --down
```

## What the Migration Does

### 1. User Role Migration

Automatically migrates existing users:
- `INSTRUCTOR` → `ORG_ADMIN`
- `ADMIN` → `ORG_ADMIN`
- `STUDENT` → `CANDIDATE`
- `PROCTOR` → `ORG_ADMIN`
- `RECRUITER` → `RECRUITER` (unchanged)

Each migration is tracked in the user's `roleHistory` field.

### 2. Exam Schema Updates

Adds default values to existing exams:
- `category`: `GENERAL_ASSESSMENT`
- `accessMode`: `ENROLLMENT_BASED`

### 3. ExamSession Schema Updates

Adds default values to existing exam sessions:
- `accessSource`: `ENROLLMENT`

### 4. Result Schema Updates

Adds default values to existing results:
- `visibleToCandidate`: `true`
- `isRecruitmentExam`: `false`

### 5. Index Updates

**Dropped Indexes**:
- `exam_1_student_1_attemptNumber_1` (old unique constraint)

**New Indexes**:

Exam:
- `{ category: 1, organizationId: 1 }`
- `{ accessMode: 1 }`

ExamSession:
- `{ invitationId: 1 }`
- `{ accessSource: 1 }`
- `{ 'guestCandidateInfo.email': 1 }`

Result:
- `{ exam: 1, student: 1, attemptNumber: 1 }` (unique, partial: where student exists)
- `{ exam: 1, invitationId: 1, attemptNumber: 1 }` (unique, partial: where invitationId exists)
- `{ invitationId: 1 }`
- `{ 'guestCandidateInfo.email': 1 }`
- `{ isRecruitmentExam: 1, exam: 1 }`
- `{ exam: 1, 'shortlistingDecision.isShortlisted': 1 }`

## Important Notes

### Before Running Migration

1. **Backup your database** - Always create a backup before running migrations
2. **Test in staging** - Run the migration in a staging environment first
3. **Check environment variables** - Ensure `MONGODB_URI` or `DATABASE_URL` is set
4. **Stop application servers** - Stop all running instances of the application

### After Running Migration

1. **Verify data** - Check that all documents were updated correctly
2. **Test application** - Ensure the application works with the new schema
3. **Monitor logs** - Watch for any errors related to schema changes
4. **Update API consumers** - Notify frontend/mobile teams about role changes

### Rollback Considerations

- Role rollback is **complex** - Consider restoring from backup instead
- Some constraints (like making `studentId` required again) require schema changes, not just data updates
- Always test rollback in staging before production

## Troubleshooting

### Migration Fails with "Index already exists"

This is usually safe to ignore. The migration will continue.

### Migration Fails with "Cannot connect to MongoDB"

Check your environment variables and ensure MongoDB is running:
```bash
echo $MONGODB_URI
# or
echo $DATABASE_URL
```

### User Role Migration Incomplete

Check the migration output for the count of migrated users. If some users weren't migrated, check their current role:
```javascript
db.users.find({ role: { $in: ['INSTRUCTOR', 'ADMIN', 'STUDENT', 'PROCTOR'] } })
```

### Partial Index Creation Fails

Ensure you're running MongoDB 3.2 or later, which supports partial indexes.

## Manual Verification Queries

After running the migration, verify the changes:

```javascript
// Check user role distribution
db.users.aggregate([
  { $group: { _id: '$role', count: { $sum: 1 } } }
])

// Check exams have category and accessMode
db.exams.find({ category: { $exists: false } }).count()
db.exams.find({ accessMode: { $exists: false } }).count()

// Check exam sessions have accessSource
db.examsessions.find({ accessSource: { $exists: false } }).count()

// Check results have new fields
db.results.find({ visibleToCandidate: { $exists: false } }).count()
db.results.find({ isRecruitmentExam: { $exists: false } }).count()

// Verify indexes
db.results.getIndexes()
db.examsessions.getIndexes()
db.exams.getIndexes()
```

## Migration Logs

The migration script provides detailed console output. Review the logs to ensure:
- ✅ All user roles were migrated successfully
- ✅ All exams, sessions, and results were updated
- ✅ All indexes were created successfully

## Need Help?

If you encounter issues:
1. Check the migration logs for specific error messages
2. Verify your MongoDB version (requires 3.2+)
3. Ensure you have sufficient permissions (dbAdmin role)
4. Restore from backup and retry in a controlled environment
