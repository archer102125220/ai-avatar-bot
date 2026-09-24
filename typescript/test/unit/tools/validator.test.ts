import { describe, it, expect } from 'vitest';
import {
  validate,
  extractPropertyValue,
  extract
} from '@/core/tools/validator';

describe('Unit Test: core/tools/validator.js (TypeScript)', () => {
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
        url: 'invalid-url',
        age: 150, // 超出 maximum
        score: -5, // 小於 minimum
        agree: 'not-a-boolean',
        category: 'unknown-category'
      });

      expect(result.ok).toBe(false);
      expect(result.errors).toContain('email 電子郵件格式無效');
      expect(result.errors).toContain('url 網址格式無效');
      expect(result.errors).toContain('age 不得大於 120');
      expect(result.errors).toContain('score 不得小於 0');
      expect(result.errors).toContain('agree 必須是布林值');
      expect(result.errors).toContain('category 不在允許選項內');
    });

    it('should validate phone and contact formats and non-integer integer inputs', () => {
      const contactSchema = {
        type: 'object',
        properties: {
          tel: { type: 'string', format: 'phone' },
          contactMethod: { type: 'string', format: 'contact' },
          count: { type: 'integer' },
          ratio: { type: 'number' }
        }
      };

      // Valid case
      const validRes = validate(contactSchema, {
        tel: '+886-912-345-678',
        contactMethod: 'user@test.org',
        count: 10,
        ratio: 3.14
      });
      expect(validRes.ok).toBe(true);

      // Invalid case
      const invalidRes = validate(contactSchema, {
        tel: '123', // too short
        contactMethod: 'invalid-contact',
        count: 'not-an-integer',
        ratio: 'not-a-number'
      });
      expect(invalidRes.ok).toBe(false);
      expect(invalidRes.errors).toContain('tel 電話格式無效');
      expect(invalidRes.errors).toContain('contactMethod 必須是電子郵件或電話');
      expect(invalidRes.errors).toContain('count 必須是整數');
      expect(invalidRes.errors).toContain('ratio 必須是數字');
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

    it('should extract email, url, phone, and contact from query text via regex format matching', () => {
      const emailSchema = { type: 'string', format: 'email', prefixes: [] };
      const urlSchema = { type: 'string', format: 'url', prefixes: [] };
      const phoneSchema = { type: 'string', format: 'phone', prefixes: [] };
      const contactSchema = { type: 'string', format: 'contact', prefixes: [] };
      const intSchema = { type: 'integer', prefixes: ['數量:'] };

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
      const phone = extractPropertyValue(
        'tel',
        phoneSchema,
        '我的電話是 0912-345-678 請撥打',
        {},
        false
      );
      const contact = extractPropertyValue(
        'c',
        contactSchema,
        '聯絡方式 0988-111-222 喔',
        {},
        false
      );
      const count = extractPropertyValue(
        'cnt',
        intSchema,
        '數量: 42 個',
        {},
        false
      );

      expect(email).toBe('admin@domain.org');
      expect(url).toBe('https://google.com');
      expect(phone).toBe('0912-345-678');
      expect(contact).toBe('0988-111-222');
      expect(count).toBe(42);
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

    it('should support allowWhole for single string parameter', () => {
      const stringSchema = { type: 'string', prefixes: [], maxLength: 100 };
      const val = extractPropertyValue(
        'query',
        stringSchema,
        '這是一整句查詢內容',
        {},
        true
      );
      expect(val).toBe('這是一整句查詢內容');
    });

    it('should extract enum and context direct property name values', () => {
      const enumSchema = {
        type: 'string',
        enum: ['tech', 'life', 'gaming'],
        prefixes: []
      };
      const enumVal = extractPropertyValue(
        'category',
        enumSchema,
        '我想要看 tech 相關新聞',
        {},
        false
      );
      expect(enumVal).toBe('tech');

      // Unmatched enum
      const unmatchedEnum = extractPropertyValue(
        'category',
        enumSchema,
        '沒有相符選項',
        {},
        false
      );
      expect(unmatchedEnum).toBeUndefined();

      // Direct context lookup by propertyName
      const propertySchema = { type: 'string', prefixes: [] };
      const ctxVal = extractPropertyValue(
        'author',
        propertySchema,
        '查詢文章',
        { author: '王小明' },
        false
      );
      expect(ctxVal).toBe('王小明');
    });

    it('should extract contact with email or phone, and float/integer values', () => {
      const contactSchema = { type: 'string', format: 'contact', prefixes: [] };
      const emailContact = extractPropertyValue(
        'c',
        contactSchema,
        '信箱 contact@service.io 謝謝',
        {},
        false
      );
      expect(emailContact).toBe('contact@service.io');

      const phoneContact = extractPropertyValue(
        'c',
        contactSchema,
        '電話 0911-222-333 謝謝',
        {},
        false
      );
      expect(phoneContact).toBe('0911-222-333');

      const floatSchema = { type: 'number', prefixes: ['分數:'] };
      const floatVal = extractPropertyValue(
        'score',
        floatSchema,
        '分數: 88.5 分',
        {},
        false
      );
      expect(floatVal).toBe(88.5);

      const intSchema = { type: 'integer', prefixes: ['個數:'] };
      const intVal = extractPropertyValue(
        'count',
        intSchema,
        '個數: 4.6 顆',
        {},
        false
      );
      expect(intVal).toBe(5);
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
            title: { type: 'string', prefixes: ['標題為', '主題:'] },
            author: { type: 'string', prefixes: ['作者:'] }
          },
          required: ['email', 'title']
        }
      };

      const result = extract(
        tool,
        '請寄信給 test@demo.com 標題為月度報表',
        {},
        { author: '小明' },
        ['email', 'title']
      );

      expect(result.args.email).toBe('test@demo.com');
      expect(result.args.title).toBe('月度報表');
      expect(result.args.author).toBe('小明');
      expect(result.missing).toEqual([]);
      expect(result.errors).toEqual([]);
    });
  });
});
