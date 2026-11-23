import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { C } from '../theme';

// Ícones próprios, traço geométrico (24×24).
const PATHS: Record<string, string> = {
  home: 'M3 11 L12 3.5 L21 11 M5.5 9.5 V20 H10 V14 H14 V20 H18.5 V9.5',
  list: 'M9 6 H20 M9 12 H20 M9 18 H20 M4 6 H5.5 M4 12 H5.5 M4 18 H5.5',
  vault: 'M3.5 4.5 H20.5 V18.5 H3.5 Z M7 18.5 V21 M17 18.5 V21 M17 10 V13',
  target: '',
  plus: 'M12 4.5 V19.5 M4.5 12 H19.5',
  sliders: 'M4 7 H13 M17 7 H20 M4 17 H6 M10 17 H20',
  check: 'M5 12.5 L10 17.5 L19.5 6.5',
  chevL: 'M15 5 L8 12 L15 19',
  chevR: 'M9 5 L16 12 L9 19',
  chevD: 'M5 9 L12 16 L19 9',
  flame: 'M12 2.5 C13 6.5 17.5 8.5 17.5 14 A5.5 5.5 0 0 1 6.5 14 C6.5 11 8.5 9.5 9 7.5 C10.5 9 10.8 10.5 10.8 11.8 C12.5 10.2 12.8 6.2 12 2.5 Z',
  repeat: 'M17 3 L20.5 6.5 L17 10 M3.5 12 V10.5 A4 4 0 0 1 7.5 6.5 H20.5 M7 21 L3.5 17.5 L7 14 M20.5 12 V13.5 A4 4 0 0 1 16.5 17.5 H3.5',
  trash: 'M4 7 H20 M9 7 V4 H15 V7 M6 7 L7 20.5 H17 L18 7 M10 11 V16.5 M14 11 V16.5',
  edit: 'M4 20 H8.5 L19.5 9 L15 4.5 L4 15.5 Z M13 6.5 L17.5 11',
  close: 'M6 6 L18 18 M18 6 L6 18',
  up: 'M12 19.5 V4.5 M5.5 11 L12 4.5 L18.5 11',
  down: 'M12 4.5 V19.5 M5.5 13 L12 19.5 L18.5 13',
  calendar: 'M4 5.5 H20 V20 H4 Z M4 10 H20 M8.5 3 V7.5 M15.5 3 V7.5',
  wallet: 'M3.5 7.5 H20.5 V19.5 H3.5 Z M3.5 7.5 L15 3.5 V7.5 M16 13.5 H17.5',
  bolt: 'M13.5 2.5 L4.5 14 H11.5 L10.5 21.5 L19.5 9.5 H12.5 Z',
  alert: 'M12 3.5 L21.5 20 H2.5 Z M12 10 V14 M12 16.8 V17',
  tag: 'M3.5 3.5 H11.5 L20.5 12.5 L12.5 20.5 L3.5 11.5 Z M7.8 7.8 H8',
  download: 'M12 4 V15 M7 10 L12 15 L17 10 M5 20 H19',
  upload: 'M12 15 V4 M7 9 L12 4 L17 9 M5 20 H19',
  link: 'M10 14 L14 10 M8.5 11.5 L6 14 A3.2 3.2 0 0 0 10 18 L12.5 15.5 M11.5 8.5 L14 6 A3.2 3.2 0 0 1 18 10 L15.5 12.5',
  trophy: 'M7 4 H17 V9 A5 5 0 0 1 7 9 Z M12 14 V18 M8 20.5 H16 M7 6 H4 V7 A3 3 0 0 0 7 10 M17 6 H20 V7 A3 3 0 0 1 17 10',
  user: 'M12 12 A4 4 0 1 0 12 4 A4 4 0 1 0 12 12 Z M4.5 20.5 A7.5 7.5 0 0 1 19.5 20.5',
  swap: 'M7 4 L3.5 7.5 L7 11 M3.5 7.5 H20 M17 13 L20.5 16.5 L17 20 M20.5 16.5 H4',
  eye: 'M2.5 12 C5 7 8.5 5 12 5 C15.5 5 19 7 21.5 12 C19 17 15.5 19 12 19 C8.5 19 5 17 2.5 12 Z',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, color = C.text, stroke = 2 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'target' ? (
        <>
          <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={stroke} />
          <Circle cx={12} cy={12} r={4.5} stroke={color} strokeWidth={stroke} />
          <Rect x={11} y={11} width={2} height={2} fill={color} />
        </>
      ) : name === 'sliders' ? (
        <>
          <Path d={PATHS.sliders} stroke={color} strokeWidth={stroke} strokeLinecap="square" />
          <Rect x={13} y={5} width={4} height={4} stroke={color} strokeWidth={stroke} />
          <Rect x={6} y={15} width={4} height={4} stroke={color} strokeWidth={stroke} />
        </>
      ) : name === 'vault' ? (
        <>
          <Path d={PATHS.vault} stroke={color} strokeWidth={stroke} strokeLinejoin="miter" />
          <Circle cx={10.5} cy={11.5} r={3.2} stroke={color} strokeWidth={stroke} />
        </>
      ) : name === 'eye' ? (
        <>
          <Path d={PATHS.eye} stroke={color} strokeWidth={stroke} />
          <Circle cx={12} cy={12} r={2.8} stroke={color} strokeWidth={stroke} />
        </>
      ) : (
        <Path
          d={PATHS[name]}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="square"
          strokeLinejoin="miter"
          fill={name === 'bolt' || name === 'flame' ? color : 'none'}
          fillOpacity={name === 'bolt' || name === 'flame' ? 0.25 : 0}
        />
      )}
    </Svg>
  );
}
