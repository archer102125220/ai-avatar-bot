import { describe, it, expect } from 'vitest';
import { validate, extractPropertyValue, extract } from '@/core/tools/validator';


describe('Unit Test: core/tools/validator.js', () => {
  describe('validate', () => {
    const schema = {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        url: { type: 'string', format: 'url' },
        age: { type: 'integer', minimum: 1, maximum: 120 },
        score: { type: 'number', minimum: 0, maximum: 100 },
        agree: { type: 'boolean' },
        category: { type: 'string', enum: ['tech', 'life', 'game'] }
      },
      required: ['email', 'age']
    };

    it('should validate correct inputs successfully', () => {
      const result = validate(schema, {
        email: 'user@example.com',
        url: 'https://example.com',
        age: 25,
        score: 95.5,
        agree: true,
        category: 'tech'
      });

      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.args.email).toBe('user@example.com');
      expect(result.args.age).toBe(25);
    });

    it('should report errors for missing required fields', () => {
      const result = validate(schema, {
        url: 'https://example.com'
      });

      expect(result.ok).toBe(false);
      expect(result.errors).toContain('email 為必填');
      expect(result.errors).toContain('age 為必填');
    });

    it('should report errors for invalid types and out-of-range values', () => {
      const result = validate(schema, {
        email: 'invalid-email',
        age: 150, // 超出 maximum
        score: -5, // 小於 minimum
        agree: 'not-a-boolean',
        category: 'unknown-category'
      });

      expect(result.ok).toBe(false);
      expect(result.errors).toContain('email 電子郵件格式無效');
      expect(result.errors).toContain('age 不得大於 120');
      expect(result.errors).toContain('score 不得小於 0');
      expect(result.errors).toContain('agree 必須是布林值');
      expect(result.errors).toContain('category 不在允許選項內');
    });
  });

  describe('extractPropertyValue', () => {
    it('should extract value from context by contextKey', () => {
      const propertySchema = {
        type: 'string',
        contextKey: 'user_email'
      };

      const value = extractPropertyValue(
        'email',
        propertySchema,
        '查詢資料',
        { user_email: 'context@test.com' },
        false
      );

      expect(value).toBe('context@test.com');
    });

    it('should extract email and url from query text via regex format matching', () => {
      const emailSchema = { type: 'string', format: 'email', prefixes: [] };
      const urlSchema = { type: 'string', format: 'url', prefixes: [] };

      const email = extractPropertyValue(
        'email',
        emailSchema,
        '請發送到 admin@domain.org 謝謝',
        {},
        false
      );
      const url = extractPropertyValue(
        'link',
        urlSchema,
        '參考網址是 https://google.com 可以看看',
        {},
        false
      );

      expect(email).toBe('admin@domain.org');
      expect(url).toBe('https://google.com');
    });

    it('should extract boolean values from natural language keywords', () => {
      const boolSchema = { type: 'boolean', prefixes: [] };

      expect(
        extractPropertyValue('agree', boolSchema, '我同意這個操作', {}, false)
      ).toBe(true);
      expect(
        extractPropertyValue('agree', boolSchema, '我不同意這個操作', {}, false)
      ).toBe(false);
    });
  });

  describe('extract', () => {
    it('should extract parameters, identify missing required fields and validate', () => {
      const tool = {
        name: 'send_report',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            title: { type: 'string', prefixes: ['標題為', '主題:'] }
          },
          required: ['email', 'title']
        }
      };

      const result = extract(
        tool,
        '請寄信給 test@demo.com 標題為月度報表'
      );

      expect(result.args.email).toBe('test@demo.com');
      expect(result.args.title).toBe('月度報表');
      expect(result.missing).toEqual([]);
      expect(result.errors).toEqual([]);
    });
  });
});
