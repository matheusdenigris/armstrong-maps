import Svg, { Path, Rect } from 'react-native-svg';

/** The small line icons of the docs page, drawn on a 24-unit grid with one stroke width. */
export type IconName =
  | 'book'
  | 'route'
  | 'shield'
  | 'eye'
  | 'sliders'
  | 'key'
  | 'code'
  | 'globe'
  | 'map'
  | 'helmet'
  | 'layers'
  | 'satellite'
  | 'sun'
  | 'camera'
  | 'image'
  | 'thermometer'
  | 'radiation'
  | 'wind'
  | 'mountain'
  | 'sound'
  | 'ruler'
  | 'database'
  | 'menu'
  | 'close'
  | 'chevron'
  | 'external'
  | 'search';

const PATHS: Record<IconName, string[]> = {
  book: ['M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z', 'M4 19a2 2 0 0 1 2-2h13v4H6a2 2 0 0 1-2-2z'],
  route: ['M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M8 17h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7'],
  shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z', 'M8.5 12l2.5 2.5L16 9.5'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  sliders: ['M4 6h10', 'M18 6h2', 'M4 12h4', 'M12 12h8', 'M4 18h12', 'M20 18h0', 'M16 4v4', 'M10 10v4', 'M18 16v4'],
  key: ['M15 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', 'M13.8 11.8L21 19v2h-3v-2h-2v-2h-2l-1.7-1.7'],
  code: ['M8 7l-5 5 5 5', 'M16 7l5 5-5 5', 'M14 4l-4 16'],
  globe: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M3 12h18', 'M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z'],
  map: ['M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z', 'M9 4v14', 'M15 6v14'],
  helmet: ['M4 14a8 8 0 0 1 16 0v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3z', 'M7 13h10v3H7z'],
  layers: ['M12 3l9 5-9 5-9-5 9-5z', 'M3 13l9 5 9-5', 'M3 17l9 5 9-5'],
  satellite: ['M9.5 9.5l5 5', 'M7 12l5-5 5 5-5 5-5-5z', 'M4 4l3 3', 'M17 17l3 3', 'M5 19c0-2 1-3 3-3', 'M19 5c-2 0-3 1-3 3'],
  sun: ['M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', 'M12 1v2', 'M12 21v2', 'M4.2 4.2l1.4 1.4', 'M18.4 18.4l1.4 1.4', 'M1 12h2', 'M21 12h2', 'M4.2 19.8l1.4-1.4', 'M18.4 5.6l1.4-1.4'],
  camera: ['M4 8h3l2-3h6l2 3h3v11H4V8z', 'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  image: ['M4 5h16v14H4z', 'M4 16l5-5 4 4 3-3 4 4', 'M15.5 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z'],
  thermometer: ['M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z', 'M12 9v7'],
  radiation: ['M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', 'M12 10.5L8 3.6A9 9 0 0 0 3 12h8', 'M13 12h8a9 9 0 0 0-5-8.4l-4 6.9', 'M10.5 13.3L6.5 20a9 9 0 0 0 11 0l-4-6.7'],
  wind: ['M3 8h11a3 3 0 1 0-3-3', 'M3 12h16a3 3 0 1 1-3 3', 'M3 16h7'],
  mountain: ['M2 20l7-12 4 6 3-4 6 10H2z'],
  sound: ['M4 9h4l5-4v14l-5-4H4V9z', 'M16 9a4 4 0 0 1 0 6', 'M18.5 6.5a8 8 0 0 1 0 11'],
  ruler: ['M3 17L17 3l4 4L7 21l-4-4z', 'M7 13l2 2', 'M10 10l2 2', 'M13 7l2 2'],
  database: ['M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z', 'M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6', 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  chevron: ['M9 6l6 6-6 6'],
  external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v6H4V6h6'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M16 16l5 5'],
};

type IconProps = { name: IconName; size?: number; color: string };

export function Icon({ name, size = 18, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {PATHS[name].map((d, index) => (
        <Path
          key={index}
          d={d}
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

/** A round tile with an icon, for the cards. */
export function IconTile({ name, color, background }: { name: IconName; color: string; background: string }) {
  return (
    <Svg width={36} height={36} viewBox="0 0 36 36">
      <Rect x={0} y={0} width={36} height={36} rx={18} fill={background} />
      <Svg x={8} y={8} width={20} height={20} viewBox="0 0 24 24" fill="none">
        {PATHS[name].map((d, index) => (
          <Path
            key={index}
            d={d}
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>
    </Svg>
  );
}
