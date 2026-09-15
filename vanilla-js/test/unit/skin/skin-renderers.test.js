import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockRenderer2D,
  createMockRenderer3D,
  setupWindowPixiMock
} from '../../mocks/skin-renderer-mock';
import { FIT_MODE_MAP } from '../../../core/constants';

describe('Unit Test: core/skin/skin-renderers.js (Renderer Lifecycle & Teardown)', () => {
  let stageEl;

  beforeEach(() => {
    stageEl = document.createElement('div');
    stageEl.id = 'stage';
    document.body.appendChild(stageEl);
    setupWindowPixiMock();
  });

  afterEach(() => {
    stageEl.remove();
    vi.restoreAllMocks();
  });

  describe('Renderer2D Lifecycle', () => {
    it('should create mock 2D renderer with canvas, model, and pixiApp', () => {
      const renderer2D = createMockRenderer2D();
      stageEl.appendChild(renderer2D.canvas);

      expect(renderer2D.canvas).toBeDefined();
      expect(renderer2D.avatarModel).toBeDefined();
      expect(renderer2D.pixiApp).toBeDefined();
      expect(typeof renderer2D.fit).toBe('function');
      expect(typeof renderer2D.dispose).toBe('function');
    });

    it('should invoke fit and updateTransform without visual coupling breakage', () => {
      const renderer2D = createMockRenderer2D();

      renderer2D.fit();
      expect(renderer2D.fit).toHaveBeenCalledOnce();

      renderer2D.updateTransform({ zoom: 2.0, fitMode: FIT_MODE_MAP.HALF });
      expect(renderer2D.updateTransform).toHaveBeenCalledWith({
        zoom: 2.0,
        fitMode: FIT_MODE_MAP.HALF
      });
    });

    it('should teardown canvas and pixiApp on dispose', () => {
      const renderer2D = createMockRenderer2D();
      stageEl.appendChild(renderer2D.canvas);
      expect(stageEl.contains(renderer2D.canvas)).toBe(true);

      renderer2D.dispose();
      expect(renderer2D.dispose).toHaveBeenCalledOnce();
    });
  });

  describe('Renderer3D Lifecycle', () => {
    it('should create mock 3D renderer with camera, scene, and vrm', () => {
      const renderer3D = createMockRenderer3D();
      stageEl.appendChild(renderer3D.canvas);

      expect(renderer3D.canvas).toBeDefined();
      expect(renderer3D.camera).toBeDefined();
      expect(renderer3D.scene).toBeDefined();
      expect(renderer3D.vrm).toBeDefined();
      expect(renderer3D.TAP_GESTURES).toContain('wave');
    });

    it('should support playGesture, setPaused, and updateTransform', () => {
      const renderer3D = createMockRenderer3D();

      renderer3D.playGesture('wave');
      expect(renderer3D.playGesture).toHaveBeenCalledWith('wave');

      renderer3D.setPaused(true);
      expect(renderer3D.setPaused).toHaveBeenCalledWith(true);

      renderer3D.updateTransform({ camera: { fov: 40 } });
      expect(renderer3D.updateTransform).toHaveBeenCalledWith({ camera: { fov: 40 } });
    });

    it('should cleanup scene, mixer, and canvas on dispose', () => {
      const renderer3D = createMockRenderer3D();
      stageEl.appendChild(renderer3D.canvas);
      expect(stageEl.contains(renderer3D.canvas)).toBe(true);

      renderer3D.dispose();
      expect(renderer3D.dispose).toHaveBeenCalledOnce();
    });
  });
});
