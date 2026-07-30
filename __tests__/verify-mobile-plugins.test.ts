/**
 * Phase 4 — native plugins.
 *
 * The point of every test here is the platform seam: on web the app must behave
 * exactly as it did before Phase 4 and must never load a Capacitor plugin; on
 * native it must go through the plugin. `isMobileApp` is mocked because jsdom is
 * neither platform.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, renderHook, screen, waitFor, act } from '@testing-library/react';

/** Flipped per test to stand in for "running inside the native shell". */
const native = { current: false };

vi.mock('@/lib/mobile-auth', () => ({
  isMobileApp: async () => native.current,
}));

type NetworkListener = (status: { connected: boolean }) => void;

const networkMock = {
  connected: true,
  listeners: [] as NetworkListener[],
  removeCalls: 0,
  getStatusCalls: 0,
};

vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: async () => {
      networkMock.getStatusCalls += 1;
      return { connected: networkMock.connected, connectionType: 'wifi' };
    },
    addListener: async (_event: string, handler: NetworkListener) => {
      networkMock.listeners.push(handler);
      return {
        remove: async () => {
          networkMock.removeCalls += 1;
        },
      };
    },
  },
}));

const statusBarMock = { style: null as string | null, color: null as string | null };

vi.mock('@capacitor/status-bar', () => ({
  Style: { Light: 'LIGHT', Dark: 'DARK', Default: 'DEFAULT' },
  StatusBar: {
    setStyle: async ({ style }: { style: string }) => {
      statusBarMock.style = style;
    },
    setBackgroundColor: async ({ color }: { color: string }) => {
      statusBarMock.color = color;
    },
  },
}));

const splashMock = { hideCalls: 0 };

vi.mock('@capacitor/splash-screen', () => ({
  SplashScreen: {
    hide: async () => {
      splashMock.hideCalls += 1;
    },
  },
}));

vi.mock('@capacitor/camera', () => ({
  CameraErrorCode: {
    TakePhotoCancelled: 'OS-PLUG-CAMR-0006',
    ChooseMediaCancelled: 'OS-PLUG-CAMR-0020',
  },
  Camera: { takePhoto: async () => ({}), chooseFromGallery: async () => ({ results: [] }) },
}));

import { PhotoUpload } from '@/components/forms/PhotoUpload';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { initStatusBar, STATUS_BAR_COLOR } from '@/lib/mobile-statusbar';
import { initSplashScreen } from '@/lib/mobile-splash';

/** jsdom's navigator.onLine is a getter, so it has to be spied rather than assigned. */
function setBrowserOnline(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value);
}

beforeEach(() => {
  native.current = false;
  networkMock.connected = true;
  networkMock.listeners = [];
  networkMock.removeCalls = 0;
  networkMock.getStatusCalls = 0;
  statusBarMock.style = null;
  statusBarMock.color = null;
  splashMock.hideCalls = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useOnlineStatus on web', () => {
  it('reports navigator.onLine and never touches the Network plugin', async () => {
    setBrowserOnline(false);

    const { result } = renderHook(() => useOnlineStatus());

    await waitFor(() => expect(result.current).toBe(false));
    expect(networkMock.getStatusCalls).toBe(0);
    expect(networkMock.listeners).toHaveLength(0);
  });

  it('still responds to window online/offline events', async () => {
    setBrowserOnline(true);

    const { result } = renderHook(() => useOnlineStatus());
    await waitFor(() => expect(result.current).toBe(true));

    setBrowserOnline(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);

    setBrowserOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });
});

describe('useOnlineStatus on native', () => {
  it('seeds from Network.getStatus rather than navigator.onLine', async () => {
    native.current = true;
    networkMock.connected = false;
    // Deliberately disagrees with the plugin: the plugin must win on native.
    setBrowserOnline(true);

    const { result } = renderHook(() => useOnlineStatus());

    await waitFor(() => expect(result.current).toBe(false));
    expect(networkMock.getStatusCalls).toBe(1);
  });

  it('updates when the plugin reports a change, and detaches on unmount', async () => {
    native.current = true;
    networkMock.connected = true;

    const { result, unmount } = renderHook(() => useOnlineStatus());
    await waitFor(() => expect(networkMock.listeners).toHaveLength(1));
    expect(result.current).toBe(true);

    // Going offline mid-form is the case that decides whether a worklog queues.
    act(() => {
      networkMock.listeners[0]({ connected: false });
    });
    expect(result.current).toBe(false);

    act(() => {
      networkMock.listeners[0]({ connected: true });
    });
    expect(result.current).toBe(true);

    unmount();
    await waitFor(() => expect(networkMock.removeCalls).toBe(1));
  });

  it('does not add window listeners when the plugin is driving', async () => {
    native.current = true;
    const addListener = vi.spyOn(window, 'addEventListener');

    renderHook(() => useOnlineStatus());
    await waitFor(() => expect(networkMock.listeners).toHaveLength(1));

    const connectivityListeners = addListener.mock.calls.filter(
      ([event]) => event === 'online' || event === 'offline',
    );
    expect(connectivityListeners).toHaveLength(0);
  });
});

describe('initStatusBar', () => {
  it('is a no-op on web', async () => {
    await initStatusBar();
    expect(statusBarMock.style).toBeNull();
    expect(statusBarMock.color).toBeNull();
  });

  it('applies dark-on-yellow styling on native', async () => {
    native.current = true;

    await initStatusBar();

    // Style.Light means "light background", i.e. dark icons — legible on yellow.
    expect(statusBarMock.style).toBe('LIGHT');
    expect(statusBarMock.color).toBe(STATUS_BAR_COLOR);
  });

  it('matches the splash backgroundColor in capacitor.config.ts', async () => {
    const config = await import('@/capacitor.config');
    expect(config.default.plugins?.SplashScreen?.backgroundColor).toBe(STATUS_BAR_COLOR);
  });
});

describe('PhotoUpload picker UI', () => {
  function renderPhotoUpload() {
    return render(createElement(PhotoUpload, { value: [], onChange: () => {} }));
  }

  it('offers the file input on web', async () => {
    const { container } = renderPhotoUpload();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Add Photos' })).toBeTruthy());
    expect(container.querySelector('input[type="file"]')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Take Photo' })).toBeNull();
  });

  it('offers camera and gallery buttons on native', async () => {
    native.current = true;

    renderPhotoUpload();

    // Resolved after mount, so the buttons swap in asynchronously.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Take Photo' })).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Gallery' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add Photos' })).toBeNull();
  });
});

describe('initSplashScreen', () => {
  it('is a no-op on web', async () => {
    await initSplashScreen();
    expect(splashMock.hideCalls).toBe(0);
  });

  it('hides the splash on native', async () => {
    native.current = true;

    await initSplashScreen();

    expect(splashMock.hideCalls).toBe(1);
  });
});
