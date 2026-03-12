import React, { useState } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';

// 방사형 차트
export const NutrientRadarChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={357}>
    <RadarChart
      cx="50%"
      cy="50%"
      outerRadius="90%"
      data={data}
      margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
    >
      <PolarGrid stroke="#d0d0d0" opacity={0.8} />
      <PolarAngleAxis
        dataKey="subject"
        tick={{ fill: '#1E2923', fontSize: 14 }}
      />
      <PolarRadiusAxis
        angle={90}
        domain={[0, 100]}
        tick={{
          fill: '#777',
          fontSize: 12,
          dy: 8,
          dx: -8,
        }}
        axisLine={false}
      />
      <Radar
        name="영양소"
        dataKey="value"
        stroke="#FF8243"
        fill="#FF8243"
        fillOpacity={0.5}
      />
    </RadarChart>
  </ResponsiveContainer>
);

// 7일간 변화 추이
export const WeeklyLineChart = ({ data }) => {
  // 활성화된 시리즈 상태 관리
  const [activeSeries, setActiveSeries] = useState([
    'kcal',
    'carbohydrate',
    'protein',
    'fat',
    'sugars',
  ]);

  const seriesOrder = [
    { dataKey: 'kcal', color: '#FF8243', label: '칼로리' },
    { dataKey: 'carbohydrate', color: '#FFA726', label: '탄수화물' },
    { dataKey: 'protein', color: '#66BB6A', label: '단백질' },
    { dataKey: 'fat', color: '#EF5350', label: '지방' },
    { dataKey: 'sugars', color: '#AB47BC', label: '당' },
  ];

  // 범례 클릭 핸들러
  const handleLegendClick = (e) => {
    const { dataKey } = e;
    if (activeSeries.includes(dataKey)) {
      setActiveSeries(activeSeries.filter((item) => item !== dataKey));
    } else {
      setActiveSeries([...activeSeries, dataKey]);
    }
  };

  // 범례 텍스트 커스텀 (비활성 시 글자만 회색)
  const renderCustomLegendText = (value, entry) => {
    const { dataKey } = entry;
    const isActive = activeSeries.includes(dataKey);
    return (
      <span
        style={{
          color: isActive ? '#333' : '#ccc',
          cursor: 'pointer',
          marginLeft: '3px',
          fontWeight: '400',
        }}
      >
        {value}
      </span>
    );
  };

  // 라인 생성 헬퍼 함수
  const createLine = (dataKey, color, isMain = false) => {
    const isActive = activeSeries.includes(dataKey);
    return (
      <Line
        key={dataKey}
        type="monotone"
        dataKey={dataKey}
        stroke={color}
        strokeWidth={isMain ? 2 : 2}
        strokeOpacity={isActive ? 1 : 0}
        dot={isActive ? { r: 3, fill: color } : false}
        activeDot={isActive ? { r: 3 } : false}
      />
    );
  };

  return (
    <ResponsiveContainer width="100%" height={343}>
      <LineChart data={data} margin={{ top: 5, right: 35, left: 0, bottom: 5 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="#f0f0f0"
        />
        <XAxis dataKey="day" />
        <YAxis />
        <Tooltip />
        <Legend
          onClick={handleLegendClick}
          formatter={renderCustomLegendText}
          iconType="circle"
          iconSize={11}
          payload={seriesOrder.map((item) => ({
            dataKey: item.dataKey,
            value: item.label,
            color: item.color,
            inactive: !activeSeries.includes(item.dataKey),
          }))}
          wrapperStyle={{
            cursor: 'pointer',
            paddingTop: '15px',
            display: 'flex',
            justifyContent: 'center',
            minWidth: '20px',
          }}
        />
        {createLine('kcal', '#FF8243')}
        {createLine('carbohydrate', '#FFA726')}
        {createLine('protein', '#66BB6A')}
        {createLine('fat', '#EF5350')}
        {createLine('sugars', '#AB47BC')}
      </LineChart>
    </ResponsiveContainer>
  );
};
