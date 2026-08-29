import React from 'react';
import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';

// Shared, app-wide icon set — clean Feather-style stroke glyphs (24×24, round
// caps). Standard and instantly recognisable, so buttons read clearly without a
// label. Usage: <Icon name="share" size={20} color="#fff" />
//
// Most icons are plain stroke paths; a few that need circles/lines are handled
// as special cases below.
const PATHS = {
  'arrow-left': ['M19 12H5', 'M12 19l-7-7 7-7'],
  'arrow-right': ['M5 12h14', 'M12 5l7 7-7 7'],
  'chevron-left': ['M15 18l-6-6 6-6'],
  'chevron-right': ['M9 18l6-6-6-6'],
  'chevron-down': ['M6 9l6 6 6-6'],
  'chevron-up': ['M18 15l-6-6-6 6'],
  x: ['M18 6L6 18', 'M6 6l12 12'],
  // Save-to-gallery: tray with a down arrow.
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  // Share: box with an up-and-out arrow (the universally understood "share").
  share: ['M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7', 'M16 6l-4-4-4 4', 'M12 2v13'],
  home: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  edit: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z'],
  trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M10 11v6', 'M14 11v6'],
  check: ['M20 6L9 17l-5-5'],
  refresh: ['M23 4v6h-6', 'M1 20v-6h6', 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10', 'M1 14l4.64 4.36A9 9 0 0 0 20.49 15'],
  // Adjust/settings: sliders — clearer than a gear at small sizes.
  sliders: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54L22 3z'],
  users: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  calendar: ['M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
};

const Icon = ({ name, size = 24, color = '#0f172a', strokeWidth = 2, style }) => {
  const common = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      {name === 'award' ? (
        <>
          <Circle cx={12} cy={8} r={6} {...common} />
          <Path d="M15.48 12.89L17 22l-5-3-5 3 1.52-9.11" {...common} />
        </>
      ) : name === 'trophy' ? (
        <>
          <Path d="M6 4h12v4a6 6 0 0 1-12 0V4z" {...common} />
          <Path d="M6 6H4a2 2 0 0 0 0 4h2" {...common} />
          <Path d="M18 6h2a2 2 0 0 1 0 4h-2" {...common} />
          <Line x1={9} y1={20} x2={15} y2={20} {...common} />
          <Line x1={12} y1={14} x2={12} y2={20} {...common} />
        </>
      ) : name === 'info' ? (
        <>
          <Circle cx={12} cy={12} r={10} {...common} />
          <Line x1={12} y1={16} x2={12} y2={12} {...common} />
          <Line x1={12} y1={8} x2={12.01} y2={8} {...common} />
        </>
      ) : name === 'alert' ? (
        <>
          <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" {...common} />
          <Line x1={12} y1={9} x2={12} y2={13} {...common} />
          <Line x1={12} y1={17} x2={12.01} y2={17} {...common} />
        </>
      ) : name === 'settings' ? (
        <>
          <Circle cx={12} cy={12} r={3} {...common} />
          <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" {...common} />
        </>
      ) : name === 'clock' ? (
        <>
          <Circle cx={12} cy={12} r={10} {...common} />
          <Polyline points="12 6 12 12 16 14" {...common} />
        </>
      ) : name === 'user' ? (
        <>
          <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" {...common} />
          <Circle cx={12} cy={7} r={4} {...common} />
        </>
      ) : name === 'share-nodes' ? (
        <>
          <Circle cx={18} cy={5} r={3} {...common} />
          <Circle cx={6} cy={12} r={3} {...common} />
          <Circle cx={18} cy={19} r={3} {...common} />
          <Line x1={8.59} y1={13.51} x2={15.42} y2={17.49} {...common} />
          <Line x1={15.41} y1={6.51} x2={8.59} y2={10.49} {...common} />
        </>
      ) : (
        (PATHS[name] || []).map((d, i) => <Path key={i} d={d} {...common} />)
      )}
    </Svg>
  );
};

export default Icon;
