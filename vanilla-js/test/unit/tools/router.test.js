import { describe, it, expect } from 'vitest';
import { scoreTool, route } from '../../../core/tools/router';
import { normaliseTool } from '../../../core/tools/schema';
import { TOOL_ROUTING_MODE_MAP } from '../../../core/constants';

describe('Unit Test: core/tools/router.js', () => {
  describe('scoreTool', () => {
    it('should return score 0 if query contains excludeKeywords', () => {
      const tool = normaliseTool({
        name: 'query_weather',
        keywords: ['天氣'],
        excludeKeywords: ['取消', '不要']
      });

      const result = scoreTool(tool, '不要查天氣');
      expect(result.score).toBe(0);
      expect(result.reason).toBe('excluded');
    });

    it('should score high when keyword matches query', () => {
      const tool = normaliseTool({
        name: 'query_weather',
        keywords: ['天氣', '氣溫']
      });

      const result = scoreTool(tool, '今天台北天氣如何？');
      expect(result.score).toBeGreaterThan(0.6);
      expect(result.reason).toBe('keyword:天氣');
    });

    it('should calculate similarity for examples', () => {
      const tool = normaliseTool({
        name: 'open_music',
        examples: ['我想聽周杰倫的歌']
      });

      const result = scoreTool(tool, '我想聽周杰倫的音樂');
      expect(result.score).toBeGreaterThan(0.3);
      expect(result.reason).toBe('example');
    });
  });

  describe('route', () => {
    const tools = [
      {
        name: 'weather_tool',
        keywords: ['天氣', '下雨', '氣溫'],
        routeThreshold: 0.35,
        priority: 1
      },
      {
        name: 'stock_tool',
        keywords: ['股票', '股價', '大盤'],
        routeThreshold: 0.35,
        priority: 0
      },
      {
        name: 'ai_only_tool',
        routingMode: TOOL_ROUTING_MODE_MAP.AI,
        keywords: ['天氣']
      }
    ];

    it('should accurately route to the best matching tool', () => {
      const result = route(tools, '幫我查一下台積電股價');

      expect(result.match).not.toBeNull();
      expect(result.match?.tool.name).toBe('stock_tool');
      expect(result.ambiguous).toEqual([]);
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('should ignore AI-only tools during client routing', () => {
      const result = route(tools, '台北今天下雨嗎');

      expect(result.match).not.toBeNull();
      expect(result.match?.tool.name).toBe('weather_tool');
      expect(result.candidates.some((c) => c.tool.name === 'ai_only_tool')).toBe(
        false
      );
    });

    it('should mark as ambiguous when two candidates have very close scores', () => {
      const ambiguousTools = [
        {
          name: 'music_player_a',
          keywords: ['播放音樂'],
          routeThreshold: 0.3,
          priority: 0
        },
        {
          name: 'music_player_b',
          keywords: ['播放音樂'],
          routeThreshold: 0.3,
          priority: 0
        }
      ];

      const result = route(ambiguousTools, '請播放音樂');
      expect(result.match).toBeNull();
      expect(result.ambiguous.length).toBe(2);
    });
  });
});
