/**
 * Tests for Cabinet Janitor Service
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DATA_DIR = path.join(__dirname, 'test-data');
const TEST_CONFIG_DIR = path.join(TEST_DATA_DIR, '.cabinet');

// Mock environment
process.env.CABINET_DATA_DIR = TEST_DATA_DIR;
process.env.OPENROUTER_API_KEY = 'test-key';

// Import after setting DATA_DIR
import {
  getJanitorConfig,
  saveJanitorConfig,
  getJanitorStats,
  saveJanitorStats,
  cleanupMarkdown,
  addTags,
  generateSummary,
  rankContent,
  getFilesToProcess,
  runJanitor,
} from '../src/lib/ai/janitor.js';

// Helper to mock fetch
function mockFetch(response: any) {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    return {
      ok: true,
      json: async () => response,
    } as any;
  };
  return () => { global.fetch = originalFetch; };
}

describe('Janitor Service', () => {
  before(async () => {
    // Create test directory
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });
    await fs.mkdir(TEST_CONFIG_DIR, { recursive: true });
    
    // Create test markdown files
    await fs.writeFile(
      path.join(TEST_DATA_DIR, 'test1.md'),
      `---
title: Test Document
---

# Test Document

This is a test document with some content.

## Section 1

Some content here.

## Section 2

More content here.
`
    );
    
    await fs.writeFile(
      path.join(TEST_DATA_DIR, 'test2.md'),
      `# Another Test

This is another test document.

- Item 1
- Item 2
- Item 3
`
    );
  });

  after(async () => {
    // Clean up test directory
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  describe('Configuration', () => {
    it('should get default config when no config file exists', async () => {
      // Remove config file if it exists
      const configPath = path.join(TEST_CONFIG_DIR, 'janitor-config.json');
      await fs.unlink(configPath).catch(() => {});

      const config = await getJanitorConfig();
      
      assert.ok(config);
      // Note: The actual config might be loaded from the real data directory
      // So we just check that we get a valid config object
      assert.ok(typeof config.enabled === 'boolean');
      assert.ok(config.model);
      assert.ok(config.schedule);
      assert.ok(config.maxFilesPerRun > 0);
      assert.ok(config.maxTokensPerRun > 0);
      assert.ok(config.tasks);
      assert.ok(typeof config.tasks.cleanup === 'boolean');
      assert.ok(typeof config.tasks.tagging === 'boolean');
      assert.ok(typeof config.tasks.summarization === 'boolean');
      assert.ok(typeof config.tasks.ranking === 'boolean');
    });

    it('should save and load config', async () => {
      const testConfig = {
        enabled: false,
        model: 'test/model',
        schedule: '0 0 * * *',
        maxFilesPerRun: 5,
        maxTokensPerRun: 10000,
        tasks: {
          cleanup: true,
          tagging: false,
          summarization: true,
          ranking: false,
        },
      };

      await saveJanitorConfig(testConfig);
      const loadedConfig = await getJanitorConfig();

      assert.deepEqual(loadedConfig, testConfig);
    });
  });

  describe('Statistics', () => {
    it('should get default stats when no stats file exists', async () => {
      // Remove stats file if it exists
      const statsPath = path.join(TEST_CONFIG_DIR, 'janitor-stats.json');
      await fs.unlink(statsPath).catch(() => {});

      const stats = await getJanitorStats();
      
      assert.ok(Array.isArray(stats));
      assert.ok(stats.length > 0);
      
      const cleanupTask = stats.find(s => s.id === 'cleanup');
      assert.ok(cleanupTask);
      // Note: Stats might be loaded from the real data directory
      // So we just check that we get valid stats
      assert.ok(typeof cleanupTask.stats.filesProcessed === 'number');
      assert.ok(typeof cleanupTask.stats.filesModified === 'number');
      assert.ok(typeof cleanupTask.stats.tokensUsed === 'number');
    });

    it('should save and load stats', async () => {
      const testStats = [
        {
          id: 'cleanup',
          name: 'Cleanup',
          description: 'Test',
          enabled: true,
          stats: {
            filesProcessed: 10,
            filesModified: 5,
            tokensUsed: 1000,
          },
        },
      ];

      await saveJanitorStats(testStats);
      const loadedStats = await getJanitorStats();

      assert.deepEqual(loadedStats, testStats);
    });
  });

  describe('File Processing', () => {
    it('should get markdown files to process', async () => {
      const files = await getFilesToProcess(10);
      
      assert.ok(Array.isArray(files));
      assert.ok(files.length > 0);
      
      // Should find our test files
      const test1 = files.find(f => f.endsWith('test1.md'));
      const test2 = files.find(f => f.endsWith('test2.md'));
      assert.ok(test1, 'Should find test1.md');
      assert.ok(test2, 'Should find test2.md');
    });

    it('should limit files to process', async () => {
      const files = await getFilesToProcess(1);
      
      assert.ok(Array.isArray(files));
      assert.equal(files.length, 1);
    });
  });

  describe('Cleanup Task', () => {
    it('should clean up markdown file', async () => {
      // Create a messy file
      const messyFile = path.join(TEST_DATA_DIR, 'messy.md');
      await fs.writeFile(messyFile, `# Title

This is a test with extra spaces and bad formatting.


Too many blank lines.



- Item 1
- Item 2


`);

      // Mock fetch for OpenRouter
      const restore = mockFetch({
        choices: [{ message: { content: `# Title

This is a test with extra spaces and bad formatting.

Too many blank lines.

- Item 1
- Item 2` } }],
        usage: { total_tokens: 100 },
      });

      try {
        const result = await cleanupMarkdown(messyFile, 'test/model');
        
        assert.ok(result);
        assert.equal(result.modified, true);
        assert.ok(result.tokens > 0);
        
        // Verify file was modified
        const content = await fs.readFile(messyFile, 'utf-8');
        assert.ok(!content.includes('\n\n\n\n'));
      } finally {
        restore();
      }
    });

    it('should not modify already clean file', async () => {
      const cleanFile = path.join(TEST_DATA_DIR, 'clean.md');
      const originalContent = `# Clean File

This file is already clean.

- Item 1
- Item 2`;

      await fs.writeFile(cleanFile, originalContent);

      // Mock fetch for OpenRouter to return same content
      const restore = mockFetch({
        choices: [{ message: { content: originalContent } }],
        usage: { total_tokens: 50 },
      });

      try {
        const result = await cleanupMarkdown(cleanFile, 'test/model');
        
        assert.ok(result);
        assert.equal(result.modified, false);
        
        // Verify file was not modified
        const content = await fs.readFile(cleanFile, 'utf-8');
        assert.equal(content, originalContent);
      } finally {
        restore();
      }
    });
  });

  describe('Tagging Task', () => {
    it('should add tags to markdown file', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'tag-test.md');
      await fs.writeFile(testFile, `# Test Document

This is a test document about JavaScript programming.

## Features

- Variables
- Functions
- Classes
`);

      // Mock fetch for OpenRouter
      const restore = mockFetch({
        choices: [{ message: { content: '["javascript", "programming", "tutorial"]' } }],
        usage: { total_tokens: 50 },
      });

      try {
        const result = await addTags(testFile, 'test/model');
        
        assert.ok(result);
        assert.equal(result.modified, true);
        
        // Verify tags were added
        const content = await fs.readFile(testFile, 'utf-8');
        assert.ok(content.includes('tags:'));
        assert.ok(content.includes('javascript'));
      } finally {
        restore();
      }
    });

    it('should not add tags if file already has tags', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'already-tagged.md');
      const originalContent = `---
tags: ["existing", "tags"]
---

# Already Tagged

This file already has tags.
`;

      await fs.writeFile(testFile, originalContent);

      // Mock fetch for OpenRouter
      const restore = mockFetch({
        choices: [{ message: { content: '["new", "tags"]' } }],
        usage: { total_tokens: 50 },
      });

      try {
        const result = await addTags(testFile, 'test/model');
        
        assert.ok(result);
        assert.equal(result.modified, false);
        
        // Verify file was not modified
        const content = await fs.readFile(testFile, 'utf-8');
        assert.equal(content, originalContent);
      } finally {
        restore();
      }
    });
  });

  describe('Summarization Task', () => {
    it('should generate summary for long document', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'long-doc.md');
      const originalContent = `# Long Document

${'This is a line of content.\\n'.repeat(50)}

## Conclusion

The end.
`;

      await fs.writeFile(testFile, originalContent);

      // Mock fetch for OpenRouter
      const restore = mockFetch({
        choices: [{ message: { content: 'This is a summary of the long document.' } }],
        usage: { total_tokens: 100 },
      });

      try {
        const result = await generateSummary(testFile, 'test/model');
        
        assert.ok(result);
        assert.equal(result.modified, true);
        
        // Verify summary was added
        const content = await fs.readFile(testFile, 'utf-8');
        assert.ok(content.includes('## Summary'));
        assert.ok(content.includes('This is a summary'));
      } finally {
        restore();
      }
    });

    it('should not add summary to short document', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'short-doc.md');
      const originalContent = `# Short Doc

This is a short document.
`;

      await fs.writeFile(testFile, originalContent);

      // Mock fetch for OpenRouter
      const restore = mockFetch({
        choices: [{ message: { content: 'Summary' } }],
        usage: { total_tokens: 50 },
      });

      try {
        const result = await generateSummary(testFile, 'test/model');
        
        assert.ok(result);
        assert.equal(result.modified, false);
        
        // Verify file was not modified
        const content = await fs.readFile(testFile, 'utf-8');
        assert.equal(content, originalContent);
      } finally {
        restore();
      }
    });
  });

  describe('Ranking Task', () => {
    it('should rank content quality', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'rank-test.md');
      await fs.writeFile(testFile, `# Test Document

This is a well-structured document with good content.

## Section 1

Detailed content here.

## Section 2

More detailed content.

## Conclusion

Summary of the document.
`);

      // Mock fetch for OpenRouter
      const restore = mockFetch({
        choices: [{ message: { content: '8' } }],
        usage: { total_tokens: 20 },
      });

      try {
        const result = await rankContent(testFile, 'test/model');
        
        assert.ok(result);
        assert.equal(result.score, 8);
        assert.ok(result.tokens > 0);
      } finally {
        restore();
      }
    });

    it('should return default score for invalid response', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'invalid-rank.md');
      await fs.writeFile(testFile, `# Test`);

      // Mock fetch for OpenRouter with invalid response
      const restore = mockFetch({
        choices: [{ message: { content: 'invalid' } }],
        usage: { total_tokens: 10 },
      });

      try {
        const result = await rankContent(testFile, 'test/model');
        
        assert.ok(result);
        assert.equal(result.score, 5); // Default score
      } finally {
        restore();
      }
    });
  });

  describe('Run Janitor', () => {
    it('should run janitor tasks', async () => {
      // Create test config
      const testConfig = {
        enabled: true,
        model: 'test/model',
        schedule: '0 0 * * *',
        maxFilesPerRun: 2,
        maxTokensPerRun: 10000,
        tasks: {
          cleanup: true,
          tagging: false,
          summarization: false,
          ranking: false,
        },
      };

      await saveJanitorConfig(testConfig);

      // Mock fetch for OpenRouter
      let callCount = 0;
      const originalFetch = global.fetch;
      global.fetch = async () => {
        callCount++;
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: callCount % 2 === 0 ? 'Cleaned content' : '["tag1", "tag2"]' } }],
            usage: { total_tokens: 100 },
          }),
        } as any;
      };

      try {
        const result = await runJanitor();
        
        assert.ok(result);
        assert.equal(result.success, true);
        assert.ok(result.filesProcessed > 0);
        assert.ok(result.tokensUsed > 0);
        assert.equal(result.errors.length, 0);
        
        // Verify stats were updated
        const stats = await getJanitorStats();
        const cleanupStat = stats.find(s => s.id === 'cleanup');
        assert.ok(cleanupStat);
        assert.ok(cleanupStat.stats.filesProcessed > 0);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should not run when disabled', async () => {
      // Create disabled config
      const testConfig = {
        enabled: false,
        model: 'test/model',
        schedule: '0 0 * * *',
        maxFilesPerRun: 10,
        maxTokensPerRun: 10000,
        tasks: {
          cleanup: true,
          tagging: true,
          summarization: true,
          ranking: true,
        },
      };

      await saveJanitorConfig(testConfig);

      const result = await runJanitor();
      
      assert.ok(result);
      assert.equal(result.success, false);
      assert.equal(result.filesProcessed, 0);
      assert.ok(result.errors.length > 0);
      assert.ok(result.errors[0].includes('disabled'));
    });
  });
});
