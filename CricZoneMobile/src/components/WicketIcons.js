// Cricket dismissal icons — uses the bundled illustration assets in
// `assets/Cricket Icons/`. Each component renders an Image at the requested
// size. The `color` prop is accepted for API compatibility but ignored
// (these are full-color illustrations, not tintable monochrome glyphs).

import React from 'react';
import { Image } from 'react-native';

const SOURCES = {
  'Bowled': require('../../assets/Cricket Icons/bowled.png'),
  'Caught': require('../../assets/Cricket Icons/caught.png'),
  'LBW': require('../../assets/Cricket Icons/LBW.png'),
  'Stumped': require('../../assets/Cricket Icons/stumped.png'),
  'Hit Wicket': require('../../assets/Cricket Icons/hit_wicket.png'),
  'Run Out': require('../../assets/Cricket Icons/runout.png'),
};

const makeIcon = (type) => ({ size = 28 }) => (
  <Image
    source={SOURCES[type]}
    style={{ width: size, height: size }}
    resizeMode="contain"
  />
);

export const BowledIcon = makeIcon('Bowled');
export const CaughtIcon = makeIcon('Caught');
export const LBWIcon = makeIcon('LBW');
export const StumpedIcon = makeIcon('Stumped');
export const HitWicketIcon = makeIcon('Hit Wicket');
export const RunOutIcon = makeIcon('Run Out');

export const WICKET_ICON_BY_TYPE = {
  'Bowled': BowledIcon,
  'Caught': CaughtIcon,
  'LBW': LBWIcon,
  'Stumped': StumpedIcon,
  'Hit Wicket': HitWicketIcon,
  'Run Out': RunOutIcon,
};
