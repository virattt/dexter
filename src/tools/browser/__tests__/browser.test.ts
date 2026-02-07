import { browserTool } from '../browser';
import { readCache, writeCache } from '../../../utils/cache';

// Mock playwright to avoid actual browser launching during tests
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue({
      newContext: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
          goto: jest.fn().mockResolvedValue(undefined),
          url: jest.fn().mockReturnValue('http://mockurl.com/mocked-page'),
          title: jest.fn().mockResolvedValue('Mock Page Title'),
          evaluate: jest.fn().mockResolvedValue('Mock page content'),
          waitForLoadState: jest.fn().mockResolvedValue(undefined),
          _snapshotForAI: jest.fn().mockResolvedValue({ full: 'Mock snapshot content' }),
          $: jest.fn().mockResolvedValue({
            // Mocking the element returned by $ selector
            evaluate: jest.fn(), // Mock the evaluate method for the element
          }),
        }),
      }),
      close: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Mock the cache module
jest.mock('../../../utils/cache.js', () => ({
  readCache: jest.fn(),
  writeCache: jest.fn(),
}));

describe('browserTool performance enhancements (caching)', () => {
  const navigateEndpoint = 'browser/navigate';
  const readEndpoint = 'browser/read';

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('navigate action with caching', () => {
    it('should fetch and cache content on first navigation (cache miss)', async () => {
      // Arrange
      (readCache as jest.Mock).mockReturnValue(null); // Simulate cache miss
      const navigateUrl = 'http://example.com/nav';

      // Act
      const result = JSON.parse(await browserTool.invoke({
        action: 'navigate',
        url: navigateUrl,
      }));

      // Assert
      expect(readCache).toHaveBeenCalledWith(navigateEndpoint, { url: navigateUrl });
      expect(result.data.ok).toBe(true);
      expect(result.data.cached).toBe(false);
      expect(writeCache).toHaveBeenCalledTimes(1);
      expect(writeCache).toHaveBeenCalledWith(
        navigateEndpoint,
        { url: navigateUrl },
        expect.any(Object), // Expecting the result object to be cached
        'http://mockurl.com/mocked-page'
      );
      // Further assertions about the result content can be added if needed
      expect(result.data.url).toBe('http://mockurl.com/mocked-page');
    });

    it('should return cached content on subsequent navigation to the same URL (cache hit)', async () => {
      // Arrange
      const navigateUrl = 'http://example.com/cached-nav';
      const mockCachedData = {
        url: navigateUrl,
        data: {
          snapshot: 'cached snapshot',
          truncated: false,
          title: 'Cached Title',
          refCount: 0,
          refs: {},
        },
      };
      (readCache as jest.Mock).mockReturnValueOnce(mockCachedData); // Simulate cache hit

      // Act
      const result = JSON.parse(await browserTool.invoke({
        action: 'navigate',
        url: navigateUrl,
      }));

      // Assert
      expect(readCache).toHaveBeenCalledWith(navigateEndpoint, { url: navigateUrl });
      expect(result.data.ok).toBe(true);
      expect(result.data.cached).toBe(true);
      expect(result.data.url).toBe(navigateUrl);
      expect(result.data.snapshot).toBe('cached snapshot');
      expect(writeCache).not.toHaveBeenCalled(); // No write on cache hit
    });
  });

  describe('read action with caching', () => {
    const currentUrl = 'http://mockurl.com/mocked-page';
    it('should fetch and cache content on first read (cache miss)', async () => {
      // Arrange
      (readCache as jest.Mock).mockReturnValue(null); // Simulate cache miss
      const result = JSON.parse(await browserTool.invoke({ action: 'read' }));

      // Assert
      expect(readCache).toHaveBeenCalledWith(readEndpoint, { url: currentUrl });
      expect(result.data.url).toBe(currentUrl);
      expect(result.data.content).toBe('Mock page content');
      expect(writeCache).toHaveBeenCalledTimes(1);
      expect(writeCache).toHaveBeenCalledWith(
        readEndpoint,
        { url: currentUrl },
        expect.any(Object), // Expecting the result object to be cached
        currentUrl
      );
    });

    it('should return cached content on subsequent read (cache hit)', async () => {
      // Arrange
      const currentUrl = 'http://mockurl.com/mocked-page';
      const mockCachedData = {
        url: currentUrl,
        data: {
          title: 'Cached Read Title',
          content: 'Cached page content',
        },
      };
      (readCache as jest.Mock).mockReturnValueOnce(mockCachedData); // Simulate cache hit

      // Act
      const result = JSON.parse(await browserTool.invoke({ action: 'read' }));

      // Assert
      expect(readCache).toHaveBeenCalledWith(readEndpoint, { url: currentUrl });
      expect(result.data.url).toBe(currentUrl);
      expect(result.data.content).toBe('Cached page content');
      expect(writeCache).not.toHaveBeenCalled(); // No write on cache hit
    });
  });
});
