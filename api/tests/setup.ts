import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../.env.test') });

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
  __esModule: true,
  PrismaClient: jest.fn().mockImplementation(() => mockDeep<PrismaClient>()),
}));

// Ensure NODE_ENV is set to test
process.env.NODE_ENV = 'test';

// Mock fetch globally
(global as any).fetch = jest.fn();

// Mock WebSocket
(global as any).WebSocket = jest.fn();

// Create a mock Prisma instance
export const prismaMock = mockDeep<PrismaClient>();

beforeEach(() => {
  mockReset(prismaMock);
  jest.clearAllMocks();
});

// Helper to create mock user
export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  plan: 'free' as const,
  apiKey: 'test-api-key',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

// Helper to create mock usage record
export const createMockUsage = (overrides = {}) => ({
  id: 'usage-123',
  userId: 'user-123',
  service: 'transcription' as const,
  provider: 'openai',
  cost: '0.001',
  duration: 1.5,
  inputTokens: 100,
  outputTokens: 50,
  status: 'completed' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  error: null,
  metadata: {},
  ...overrides
});

// Helper to create mock JWT token
export const createMockToken = (payload = {}) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign({
    userId: 'user-123',
    ...payload
  }, process.env.JWT_SECRET);
};

// Helper to mock fetch responses
export const mockFetchResponse = (data: any, status = 200) => {
  const mockResponse = {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
    body: {
      getReader: jest.fn().mockReturnValue({
        read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
        releaseLock: jest.fn()
      })
    }
  };
  
  ((global as any).fetch as jest.Mock).mockResolvedValue(mockResponse);
  return mockResponse;
};

// Helper to mock streaming fetch responses
export const mockStreamingFetchResponse = (chunks: string[], status = 200) => {
  let chunkIndex = 0;
  
  const mockResponse = {
    ok: status >= 200 && status < 300,
    status,
    body: {
      getReader: jest.fn().mockReturnValue({
        read: jest.fn().mockImplementation(() => {
          if (chunkIndex < chunks.length) {
            const chunk = chunks[chunkIndex++];
            return Promise.resolve({
              done: false,
              value: new TextEncoder().encode(chunk)
            });
          }
          return Promise.resolve({ done: true, value: undefined });
        }),
        releaseLock: jest.fn()
      })
    }
  };
  
  (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
  return mockResponse;
};