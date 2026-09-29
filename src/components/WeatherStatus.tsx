import React, { useEffect, useState } from 'react';

interface WeatherData {
  temperature: number;
  weatherCode: number;
  isDay: boolean;
}

const SEOUL_WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=temperature_2m,weather_code,is_day&timezone=Asia%2FSeoul';

function describeWeather(code: number, isDay: boolean) {
  if (code === 0) return { icon: isDay ? '☀️' : '🌙', label: isDay ? '맑음' : '맑은 밤' };
  if ([1, 2].includes(code)) return { icon: isDay ? '🌤️' : '☁️', label: '구름 조금' };
  if (code === 3) return { icon: '☁️', label: '흐림' };
  if ([45, 48].includes(code)) return { icon: '🌫️', label: '안개' };
  if ([51, 53, 55, 56, 57].includes(code)) return { icon: '🌦️', label: '이슬비' };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { icon: '🌧️', label: '비' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { icon: '❄️', label: '눈' };
  if ([95, 96, 99].includes(code)) return { icon: '⛈️', label: '뇌우' };
  return { icon: '🌤️', label: '현재 날씨' };
}

export const WeatherStatus: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch(SEOUL_WEATHER_URL, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
        return response.json() as Promise<{ current?: { temperature_2m?: number; weather_code?: number; is_day?: number } }>;
      })
      .then(data => {
        const current = data.current;
        if (
          typeof current?.temperature_2m !== 'number' ||
          typeof current.weather_code !== 'number' ||
          typeof current.is_day !== 'number'
        ) {
          throw new Error('Weather response is incomplete');
        }
        setWeather({
          temperature: current.temperature_2m,
          weatherCode: current.weather_code,
          isDay: current.is_day === 1,
        });
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setFailed(true);
      });

    return () => controller.abort();
  }, []);

  if (weather) {
    const condition = describeWeather(weather.weatherCode, weather.isDay);
    return (
      <span className="weather-status" aria-label={`서울 현재 날씨 ${condition.label}, 섭씨 ${Math.round(weather.temperature)}도`}>
        <span className="weather-icon" role="img" aria-hidden="true">{condition.icon}</span>
        <span>서울 {condition.label} · {Math.round(weather.temperature)}°C</span>
      </span>
    );
  }

  return <span className="weather-status weather-status-loading">{failed ? '서울 날씨를 불러오지 못했습니다.' : '서울 날씨를 불러오는 중...'}</span>;
};
