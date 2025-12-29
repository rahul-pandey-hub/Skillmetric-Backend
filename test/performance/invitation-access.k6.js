import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const invitationAccessDuration = new Trend('invitation_access_duration');
const tokenValidations = new Counter('token_validations');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 1000 },  // Ramp up to 1000 concurrent users
    { duration: '5m', target: 5000 },  // Stay at 5000 users for 5 minutes
    { duration: '3m', target: 10000 }, // Spike to 10000 users
    { duration: '2m', target: 0 },     // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'], // 95% < 200ms, 99% < 500ms
    http_req_failed: ['rate<0.01'],                 // Error rate < 1%
    errors: ['rate<0.01'],
    invitation_access_duration: ['p(95)<200'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api';

// Sample invitation tokens (replace with actual test data)
const tokens = JSON.parse(open('./test-data/invitation-tokens.json'));

export default function () {
  const token = randomItem(tokens);

  // Test 1: Access invitation (token validation)
  const accessStart = Date.now();
  const accessRes = http.get(`${BASE_URL}/exams/invitation/${token}`, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    tags: { endpoint: 'invitation_access' },
  });

  const accessSuccess = check(accessRes, {
    'invitation access status 200': (r) => r.status === 200,
    'has valid response': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.valid !== undefined && body.exam !== undefined;
      } catch {
        return false;
      }
    },
    'response time < 200ms': (r) => r.timings.duration < 200,
    'has exam data': (r) => {
      try {
        return JSON.parse(r.body).exam.title !== undefined;
      } catch {
        return false;
      }
    },
    'has candidate data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.candidate && body.candidate.email;
      } catch {
        return false;
      }
    },
  });

  invitationAccessDuration.add(Date.now() - accessStart);
  tokenValidations.add(1);
  errorRate.add(!accessSuccess);

  // Simulate user reading exam details
  sleep(Math.random() * 3 + 2); // 2-5 seconds

  // Test 2: Start exam (if invitation is valid)
  if (accessSuccess && accessRes.status === 200) {
    const startRes = http.post(
      `${BASE_URL}/exams/invitation/${token}/start`,
      null,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        tags: { endpoint: 'invitation_start' },
      }
    );

    const startSuccess = check(startRes, {
      'exam start status 201': (r) => r.status === 201,
      'has temporary token': (r) => {
        try {
          return JSON.parse(r.body).temporaryToken !== undefined;
        } catch {
          return false;
        }
      },
      'has session ID': (r) => {
        try {
          return JSON.parse(r.body).sessionId !== undefined;
        } catch {
          return false;
        }
      },
      'has questions': (r) => {
        try {
          return Array.isArray(JSON.parse(r.body).questions);
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!startSuccess);
  }

  sleep(1);
}

// Setup function (runs once before test)
export function setup() {
  console.log('=== Performance Test Setup ===');
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Test Tokens Loaded: ${tokens.length}`);
  console.log(`Max Concurrent Users: 10000`);
  console.log('==============================');
}

// Teardown function (runs once after test)
export function teardown(data) {
  console.log('=== Performance Test Complete ===');
  console.log('Check k6 output for detailed metrics');
}
