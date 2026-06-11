'use client';

import { Cloud, CloudRain, Snowflake, Sun, Wind } from 'lucide-react';
import { cn } from '@/lib/utils';

export const WEATHER_OPTIONS = [
  { key: 'sunny', label: 'Sunny', icon: Sun },
  { key: 'cloudy', label: 'Cloudy', icon: Cloud },
  { key: 'rainy', label: 'Rainy', icon: CloudRain },
  { key: 'snow', label: 'Snow', icon: Snowflake },
  { key: 'windy', label: 'Windy', icon: Wind },
] as const;

export type WeatherKey = typeof WEATHER_OPTIONS[number]['key'];

interface WeatherPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function WeatherPicker({ value, onChange }: WeatherPickerProps) {
  const matchedKey = WEATHER_OPTIONS.find((o) => o.key === value)?.key;

  return (
    <div className="mt-1 space-y-2">
      <div className="flex flex-wrap gap-2">
        {WEATHER_OPTIONS.map(({ key, label, icon: Icon }) => {
          const selected = matchedKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(selected ? '' : key)}
              aria-pressed={selected}
              aria-label={label}
              className={cn(
                'flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-md border px-3 py-2 text-xs transition-colors',
                selected
                  ? 'border-ring bg-accent text-accent-foreground'
                  : 'border-input bg-card text-foreground hover:bg-muted/50'
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      {value && !matchedKey && (
        <p className="text-xs text-muted-foreground">
          Current: <span className="italic">{value}</span> — tap an icon to update.
        </p>
      )}
    </div>
  );
}
