import { describe, it, expect } from 'vitest';
import {
  normaliseSchema,
  normaliseTool,
  getAiAvailableTools,
  toOpenAiTools,
  argumentSummary
} from '../../../core/tools/schema';
import { TOOL_ROUTING_MODE_MAP, TOOL_RESULT_MODE_MAP } from '../../../core/constants';

describe('Unit Test: core/tools/schema.js', () => {
  describe('normaliseSchema', () => {
    it('should return empty schema object if invalid schema is passed', () => {
      expect(normaliseSchema(null)).toEqual({
        type: 'object',
        properties: {},
        required: []
      });
      expect(normaliseSchema({})).toEqual({
        type: 'object',
        properties: {},
        required: []
      });
    });

    it('should normalize valid properties and filter invalid keys', () => {
      const rawSchema = {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            title: '城市名稱',
            description: '想查詢的城市',
            maxLength: 50
          },
          days: {
            type: 'integer',
            title: '預報天數',
            minimum: 1,
            maximum: 7
          },
          '123_invalid_start_char': {
            type: 'string'
          }
        },
        required: ['city', 'not_in_properties']
      };

      const normalized = normaliseSchema(rawSchema);

      expect(normalized.type).toBe('object');
      expect(normalized.properties.city).toBeDefined();
      expect(normalized.properties.city.type).toBe('string');
      expect(normalized.properties.city.title).toBe('城市名稱');
      expect(normalized.properties.days.type).toBe('integer');
      expect(normalized.properties.days.minimum).toBe(1);
      expect(normalized.properties.days.maximum).toBe(7);

      // 非法屬性名應被排除
      expect(normalized.properties['123_invalid_start_char']).toBeUndefined();

      // required 陣列應只包含存在於 properties 的屬性
      expect(normalized.required).toEqual(['city']);
    });
  });

  describe('normaliseTool', () => {
    it('should populate default values for tool definition', () => {
      const rawTool = {
        name: 'get_weather',
        description: '查詢天氣'
      };

      const tool = normaliseTool(rawTool);
      expect(tool.name).toBe('get_weather');
      expect(tool.label).toBe('get_weather');
      expect(tool.description).toBe('查詢天氣');
      expect(tool.routingMode).toBe(TOOL_ROUTING_MODE_MAP.HYBRID);
      expect(tool.resultMode).toBe(TOOL_RESULT_MODE_MAP.AI_SUMMARY);
      expect(tool.requiresConfirmation).toBe(true);
      expect(tool.priority).toBe(0);
      expect(tool.routeThreshold).toBe(0.34);
    });

    it('should sanitize keyword arrays and enforce limits', () => {
      const rawTool = {
        name: 'search',
        keywords: ['天氣', '氣溫', ''],
        priority: 15, // 超過 10
        routeThreshold: 0.05 // 低於 0.15
      };

      const tool = normaliseTool(rawTool);
      expect(tool.keywords).toEqual(['天氣', '氣溫']);
      expect(tool.priority).toBe(10);
      expect(tool.routeThreshold).toBe(0.15);
    });
  });

  describe('getAiAvailableTools & toOpenAiTools', () => {
    const tools = [
      {
        name: 'client_ui_toggle',
        routingMode: TOOL_ROUTING_MODE_MAP.CLIENT,
        description: '純前端切換 UI'
      },
      {
        name: 'query_db',
        routingMode: TOOL_ROUTING_MODE_MAP.AI,
        description: '查詢資料庫',
        inputSchema: {
          type: 'object',
          properties: {
            sql: { type: 'string', description: 'SQL語句' }
          },
          required: ['sql']
        }
      },
      {
        name: 'hybrid_search',
        routingMode: TOOL_ROUTING_MODE_MAP.HYBRID,
        description: '雙軌搜尋'
      }
    ];

    it('getAiAvailableTools should filter out client-only tools', () => {
      const aiTools = getAiAvailableTools(tools);
      expect(aiTools.length).toBe(2);
      expect(aiTools.map((t) => t.name)).toEqual(['query_db', 'hybrid_search']);
    });

    it('toOpenAiTools should convert tools to OpenAI Function Calling JSON Schema', () => {
      const openAiTools = toOpenAiTools(tools);
      expect(openAiTools.length).toBe(2);

      const dbTool = openAiTools.find((t) => t.function.name === 'query_db');
      expect(dbTool).toBeDefined();
      expect(dbTool.type).toBe('function');
      expect(dbTool.function.parameters.type).toBe('object');
      expect(dbTool.function.parameters.properties.sql.type).toBe('string');
      expect(dbTool.function.parameters.required).toEqual(['sql']);
    });
  });

  describe('argumentSummary', () => {
    it('should generate human-readable argument summary', () => {
      const tool = {
        name: 'book_ticket',
        inputSchema: {
          type: 'object',
          properties: {
            destination: { type: 'string', title: '目的地' },
            count: { type: 'integer', title: '張數' }
          }
        }
      };

      const summary = argumentSummary(tool, {
        destination: '台北',
        count: 2
      });

      expect(summary).toBe('目的地：台北、張數：2');
    });
  });
});
