import { describe, it, expect, afterEach, vi } from 'vitest';
import { reverseGeocode } from '../lib/geocode';

describe('reverseGeocode', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the display name on a successful Nominatim response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ display_name: '123 Main St, Athens, Greece' }),
      }))
    );
    expect(await reverseGeocode(37.9715, 23.7257)).toBe('123 Main St, Athens, Greece');
  });

  it('sends lat/lon to the Nominatim reverse endpoint', async () => {
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      json: async () => ({ display_name: 'X' }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    await reverseGeocode(10, 20);
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain('nominatim.openstreetmap.org');
    expect(calledUrl).toContain('lat=10');
    expect(calledUrl).toContain('lon=20');
  });

  it('returns null on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    );
    expect(await reverseGeocode(0, 0)).toBeNull();
  });

  it('returns null when the network request rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      })
    );
    expect(await reverseGeocode(0, 0)).toBeNull();
  });

  it('returns null when display_name is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    );
    expect(await reverseGeocode(0, 0)).toBeNull();
  });
});
