/**
 * Tests for Janitor API Endpoints
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DATA_DIR = path.join(__dirname, 'test-data-api');
const TEST_CONFIG_DIR = path.join(TEST_DATA_DIR, '.cabinet');

// Mock environment
process.env.CABINET_DATA_DIR = TEST_DATA_DIR;
process.env.OPENROUTER_API_KEY = 'test-key';

// Import after setting environment
import { GET as getJanitor, POST as postJanitor } from '../src/app/api/ai/janitor/route.js';
import { GET as getOpenRouter, POST as postOpenRouter } from '../src/app/api/ai/openrouter/route.js';

describe('Janitor API Endpoints', () => {
  before(async () => {
    // Create test directory
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });
    await fs.mkdir(TEST_CONFIG_DIR, { recursive: true });
  });

  after(async () => {
    // Clean up test directory
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  describe('GET /api/ai/janitor', () => {
    it('should return janitor status and config', async () => {
      const response = await getJanitor();
      const data = await response.json();

      assert.equal(response.status, 200);
      assert.ok(data.config);
      assert.ok(data.stats);
      assert.equal(data.status, 'ready');
    });
  });

  describe('POST /api/ai/janitor', () => {
    it('should update config with update-config action', async () => {
      const newConfig = {
        enabled: false,
        model: 'updated/model',
        schedule: '0 12 * * *',
        maxFilesPerRun: 15,
        maxTokensPerRun: 20000,
        tasks: {
          cleanup: false,
          tagging: true,
          summarization: false,
          ranking: true,
        },
      };

      const request = new Request('http://localhost/api/ai/janitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-config',
          config: newConfig,
        }),
      });

      const response = await postJanitor(request);
      const data = await response.json();

      assert.equal(response.status, 200);
      assert.equal(data.success, true);
      assert.deepEqual(data.config.enabled, newConfig.enabled);
      assert.deepEqual(data.config.model, newConfig.model);
      assert.deepEqual(data.config.tasks, newConfig.tasks);
    });

    it('should enable janitor with enable action', async () => {
      // First disable it
      const disableRequest = new Request('http://localhost/api/ai/janitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' }),
      });
      await postJanitor(disableRequest);

      // Now enable it
      const enableRequest = new Request('http://localhost/api/ai/janitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable' }),
      });

      const response = await postJanitor(enableRequest);
      const data = await response.json();

      assert.equal(response.status, 200);
      assert.equal(data.success, true);
      assert.equal(data.config.enabled, true);
    });

    it('should disable janitor with disable action', async () => {
      const request = new Request('http://localhost/api/ai/janitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' }),
      });

      const response = await postJanitor(request);
      const data = await response.json();

      assert.equal(response.status, 200);
      assert.equal(data.success, true);
      assert.equal(data.config.enabled, false);
    });

    it('should return error for invalid action', async () => {
      const request = new Request('http://localhost/api/ai/janitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invalid' }),
      });

      const response = await postJanitor(request);
      const data = await response.json();

      assert.equal(response.status, 400);
      assert.ok(data.error);
    });

    it('should run janitor with run action', async () => {
      // Create test files
      await fs.writeFile(
        path.join(TEST_DATA_DIR, 'api-test.md'),
        `# API Test

This is a test file for the API.
`
      );

      // Enable janitor
      const enableRequest = new Request('http://localhost/api/ai/janitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable' }),
      });
      await postJanitor(enableRequest);

      // Mock fetch for OpenRouter
      const originalFetch = global.fetch;
      global.fetch = async () => {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Cleaned content' } }],
            usage: { total_tokens: 100 },
          }),
        } as any;
      };

      try {
        const request = new Request('http://localhost/api/ai/janitor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'run' }),
        });

        const response = await postJanitor(request);
        const data = await response.json();

        assert.equal(response.status, 200);
        assert.equal(data.success, true);
        assert.ok(data.filesProcessed >= 0);
        assert.ok(data.tokensUsed >= 0);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('GET /api/ai/openrouter', () => {
    it('should return message when API key not configured', async () => {
      const originalKey = process.env.OPENROUTER_API_KEY;
      delete process.env.OPENROUTER_API_KEY;

      try {
        const response = await getOpenRouter();
        const data = await response.json();

        assert.equal(response.status, 200);
        assert.ok(data.models);
        assert.ok(data.message);
      } finally {
        process.env.OPENROUTER_API_KEY = originalKey;
      }
    });

    it('should return models when API key configured', async () => {
      // Mock fetch for OpenRouter
      const originalFetch = global.fetch;
      global.fetch = async () => {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'test/model1',
                name: 'Test Model 1',
                description: 'A test model',
                context_length: 4096,
                pricing: { prompt: '0', completion: '0' },
              },
              {
                id: 'test/model2',
                name: 'Test Model 2',
                description: 'Another test model',
                context_length: 8192,
                pricing: { prompt: '0.001', completion: '0.002' }, // Not free
              },
            ],
          }),
        } as any;
      };

      try {
        const response = await getOpenRouter();
        const data = await response.json();

        assert.equal(response.status, 200);
        assert.ok(data.models);
        assert.ok(Array.isArray(data.models));
        assert.ok(data.models.length > 0);
        
        // Should only include free models
        const freeModel = data.models.find((m: any) => m.id === 'test/model1');
        assert.ok(freeModel);
        
        const paidModel = data.models.find((m: any) => m.id === 'test/model2');
        assert.ok(!paidModel);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('POST /api/ai/openrouter', () => {
    it('should return error when API key not configured', async () => {
      const originalKey = process.env.OPENROUTER_API_KEY;
      delete process.env.OPENROUTER_API_KEY;

      try {
        const request = new Request('http://localhost/api/ai/openrouter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'test/model',
            messages: [{ role: 'user', content: 'Hello' }],
          }),
        });

        const response = await postOpenRouter(request);
        const data = await response.json();

        assert.equal(response.status, 500);
        assert.ok(data.error);
        assert.ok(data.error.includes('API key'));
      } finally {
        process.env.OPENROUTER_API_KEY = originalKey;
      }
    });

    it('should return error for missing required fields', async () => {
      const request = new Request('http://localhost/api/ai/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing model and messages
        }),
      });

      const response = await postOpenRouter(request);
      const data = await response.json();

      assert.equal(response.status, 400);
      assert.ok(data.error);
    });

    it('should call OpenRouter API successfully', async () => {
      // Mock fetch for OpenRouter
      const originalFetch = global.fetch;
      global.fetch = async () => {
        return {
          ok: true,
          json: async () => ({
            id: 'test-id',
            choices: [{ message: { content: 'Hello! How can I help you?' } }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30,
            },
          }),
        } as any;
      };

      try {
        const request = new Request('http://localhost/api/ai/openrouter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'test/model',
            messages: [{ role: 'user', content: 'Hello' }],
            temperature: 0.5,
            max_tokens: 100,
          }),
        });

        const response = await postOpenRouter(request);
        const data = await response.json();

        assert.equal(response.status, 200);
        assert.equal(data.success, true);
        assert.equal(data.content, 'Hello! How can I help you?');
        assert.equal(data.model, 'test/model');
        assert.ok(data.usage);
        assert.equal(data.usage.total_tokens, 30);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle OpenRouter API error', async () => {
      // Mock fetch for OpenRouter error
      const originalFetch = global.fetch;
      global.fetch = async () => {
        return {
          ok: false,
          status: 429,
          text: async () => 'Rate limit exceeded',
        } as any;
      };

      try {
        const request = new Request('http://localhost/api/ai/openrouter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'test/model',
            messages: [{ role: 'user', content: 'Hello' }],
          }),
        });

        const response = await postOpenRouter(request);
        const data = await response.json();

        assert.equal(response.status, 429);
        assert.ok(data.error);
        assert.ok(data.error.includes('Rate limit'));
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
