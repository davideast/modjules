import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionCursor } from '../src/sessions';
import { ApiClient } from '../src/api';
import { SessionResource } from '../src/types';

// Mock ApiClient
const mockRequest = vi.fn();
const mockApiClient = {
  request: mockRequest,
} as unknown as ApiClient;

const mockSessions: SessionResource[] = [
  { id: '1', name: 'sessions/1' } as SessionResource,
  { id: '2', name: 'sessions/2' } as SessionResource,
  { id: '3', name: 'sessions/3' } as SessionResource,
];

describe('SessionCursor', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('should fetch the first page when awaited', async () => {
    mockRequest.mockResolvedValueOnce({
      sessions: mockSessions,
      nextPageToken: 'next-token',
    });

    const cursor = new SessionCursor(mockApiClient, { pageSize: 3 });
    const response = await cursor;

    expect(mockRequest).toHaveBeenCalledWith('sessions', {
      params: { pageSize: '3' },
    });
    expect(response.sessions).toEqual(mockSessions);
    expect(response.nextPageToken).toBe('next-token');
  });

  it('should pass pageToken correctly', async () => {
    mockRequest.mockResolvedValueOnce({
      sessions: [],
    });

    const cursor = new SessionCursor(mockApiClient, { pageToken: 'abc' });
    await cursor;

    expect(mockRequest).toHaveBeenCalledWith('sessions', {
      params: { pageToken: 'abc' },
    });
  });

  it('should iterate over all pages', async () => {
    // Page 1
    mockRequest.mockResolvedValueOnce({
      sessions: [mockSessions[0]],
      nextPageToken: 'token-1',
    });
    // Page 2
    mockRequest.mockResolvedValueOnce({
      sessions: [mockSessions[1]],
      nextPageToken: 'token-2',
    });
    // Page 3
    mockRequest.mockResolvedValueOnce({
      sessions: [mockSessions[2]],
    });

    const cursor = new SessionCursor(mockApiClient);
    const results = [];
    for await (const session of cursor) {
      results.push(session);
    }

    expect(results).toHaveLength(3);
    expect(results[0].id).toBe('1');
    expect(results[1].id).toBe('2');
    expect(results[2].id).toBe('3');
    expect(mockRequest).toHaveBeenCalledTimes(3);
    expect(mockRequest).toHaveBeenNthCalledWith(1, 'sessions', { params: {} });
    expect(mockRequest).toHaveBeenNthCalledWith(2, 'sessions', {
      params: { pageToken: 'token-1' },
    });
    expect(mockRequest).toHaveBeenNthCalledWith(3, 'sessions', {
      params: { pageToken: 'token-2' },
    });
  });

  it('should respect the global limit during iteration', async () => {
    // Page 1 (2 items)
    mockRequest.mockResolvedValueOnce({
      sessions: [mockSessions[0], mockSessions[1]],
      nextPageToken: 'token-1',
    });
    // Page 2 (1 item) - should not be fetched if limit is 2
    mockRequest.mockResolvedValueOnce({
      sessions: [mockSessions[2]],
    });

    const cursor = new SessionCursor(mockApiClient, { limit: 2 });
    const results = [];
    for await (const session of cursor) {
      results.push(session);
    }

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('1');
    expect(results[1].id).toBe('2');
    // Should only have fetched once because the first page filled the limit
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('should handle limit across page boundaries', async () => {
    // Page 1 (2 items)
    mockRequest.mockResolvedValueOnce({
      sessions: [mockSessions[0], mockSessions[1]],
      nextPageToken: 'token-1',
    });
    // Page 2 (2 items)
    mockRequest.mockResolvedValueOnce({
      sessions: [
        mockSessions[2],
        { id: '4', name: 'sessions/4' } as SessionResource,
      ],
    });

    // We want 3 items total.
    const cursor = new SessionCursor(mockApiClient, { limit: 3 });
    const results = [];
    for await (const session of cursor) {
      results.push(session);
    }

    expect(results).toHaveLength(3);
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it('should stop iteration if no more pages', async () => {
    mockRequest.mockResolvedValueOnce({
      sessions: [mockSessions[0]],
      // No nextPageToken
    });

    const cursor = new SessionCursor(mockApiClient);
    const results = await cursor.all();
    expect(results).toHaveLength(1);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('should stop iteration if sessions list is empty', async () => {
    mockRequest.mockResolvedValueOnce({
      sessions: [],
      nextPageToken: 'token-1', // Even if token exists, empty list means we might be done or API is weird.
      // The code checks: if (!response.sessions || response.sessions.length === 0) break;
    });

    const cursor = new SessionCursor(mockApiClient);
    const results = await cursor.all();
    expect(results).toHaveLength(0);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('all() helper should gather all items', async () => {
    mockRequest.mockResolvedValueOnce({
      sessions: [mockSessions[0]],
      nextPageToken: 'token-1',
    });
    mockRequest.mockResolvedValueOnce({
      sessions: [mockSessions[1]],
    });

    const cursor = new SessionCursor(mockApiClient);
    const results = await cursor.all();
    expect(results).toHaveLength(2);
  });
});
