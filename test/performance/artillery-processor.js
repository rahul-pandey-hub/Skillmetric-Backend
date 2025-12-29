const { faker } = require('@faker-js/faker');

/**
 * Artillery processor for performance testing
 * Provides helper functions for generating test data
 */

module.exports = {
  generateCandidates,
  setExamId,
  generateAnswers,
  logProgress,
};

/**
 * Generate array of candidate objects for bulk invitation testing
 */
function generateCandidates(requestParams, context, ee, next) {
  const count = context.vars.candidateCount || 100;
  const candidates = [];

  for (let i = 0; i < count; i++) {
    candidates.push({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      phone: faker.phone.number('+1##########'),
    });
  }

  context.vars.candidates = candidates;
  return next();
}

/**
 * Set exam ID from environment or use default
 */
function setExamId(requestParams, context, ee, next) {
  context.vars.examId = process.env.TEST_EXAM_ID || '507f1f77bcf86cd799439011';
  return next();
}

/**
 * Generate random answers for exam submission
 */
function generateAnswers(requestParams, context, ee, next) {
  const questionCount = context.vars.questionCount || 50;
  const answers = [];

  for (let i = 0; i < questionCount; i++) {
    answers.push({
      questionId: faker.string.alphanumeric(24),
      answer: faker.number.int({ min: 0, max: 3 }), // MCQ answer index
      // For essay questions, use:
      // answer: faker.lorem.paragraphs(2),
    });
  }

  context.vars.answers = answers;
  return next();
}

/**
 * Log progress during test execution
 */
function logProgress(requestParams, context, ee, next) {
  const now = new Date().toISOString();
  const scenario = requestParams.name || 'Unknown';

  console.log(`[${now}] ${scenario} - User ${context._uid} - Request completed`);

  // Emit custom metrics
  if (context.vars.sentCount) {
    ee.emit('counter', 'invitations.sent', context.vars.sentCount);
  }

  return next();
}

/**
 * Hook: Before each request
 */
function beforeRequest(requestParams, context, ee, next) {
  // Add custom headers
  if (!requestParams.headers) {
    requestParams.headers = {};
  }

  requestParams.headers['X-Test-Run-ID'] = process.env.TEST_RUN_ID || 'local';
  requestParams.headers['X-Performance-Test'] = 'true';

  return next();
}

/**
 * Hook: After each response
 */
function afterResponse(requestParams, response, context, ee, next) {
  // Track response times by status code
  const statusCode = response.statusCode;
  const duration = response.timings.total;

  ee.emit('histogram', `response_time.${statusCode}`, duration);

  // Track errors
  if (statusCode >= 400) {
    ee.emit('counter', `errors.${statusCode}`, 1);
    console.error(`Error ${statusCode}: ${response.body}`);
  }

  // Track specific endpoints
  const endpoint = requestParams.url.split('?')[0].split('/').pop();
  ee.emit('histogram', `endpoint.${endpoint}.duration`, duration);

  return next();
}
