import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';

import type { AvatarPresetId } from '@/domain/types';

export type AvatarCategory = 'professional' | 'tropical' | 'abstract';

export interface AvatarArtSpec {
  id: Exclude<AvatarPresetId, 'initial'>;
  category: AvatarCategory;
  bg: string;
}

export const AVATAR_CATALOG: readonly AvatarArtSpec[] = [
  { id: 'prof_exec', category: 'professional', bg: '#132A24' },
  { id: 'prof_glasses', category: 'professional', bg: '#1D2B44' },
  { id: 'prof_minimal', category: 'professional', bg: '#E8DDD0' },
  { id: 'prof_hijab', category: 'professional', bg: '#13313D' },
  { id: 'sea_palm', category: 'tropical', bg: '#1B2D45' },
  { id: 'sea_lotus', category: 'tropical', bg: '#0E312B' },
  { id: 'sea_monstera', category: 'tropical', bg: '#ECEAE0' },
  { id: 'sea_boat', category: 'tropical', bg: '#2B213A' },
  { id: 'abs_prism', category: 'abstract', bg: '#151822' },
  { id: 'abs_aura', category: 'abstract', bg: '#191432' },
  { id: 'abs_terracotta', category: 'abstract', bg: '#EFE6DC' },
  { id: 'abs_mosaic', category: 'abstract', bg: '#112922' },
] as const;

export interface AvatarArtProps {
  id: Exclude<AvatarPresetId, 'initial'>;
  size: number;
}

/**
 * Crisp offline SVG avatars spanning Professional, Tropical/SEA, and Abstract styles.
 */
export function AvatarArt({ id, size }: AvatarArtProps) {
  const clipId = `avatar-clip-${id}`;

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <ClipPath id={clipId}>
            <Circle cx={50} cy={50} r={50} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${clipId})`}>{renderArtwork(id)}</G>
      </Svg>
    </View>
  );
}

function renderArtwork(id: Exclude<AvatarPresetId, 'initial'>) {
  switch (id) {
    case 'prof_exec':
      return (
        <>
          <Rect x={0} y={0} width={100} height={100} fill="#132A24" />
          <Circle cx={72} cy={26} r={34} fill="#1E4D3E" opacity={0.55} />
          <Circle cx={20} cy={80} r={28} fill="#D4AF37" opacity={0.14} />
          {/* Blazer & shirt */}
          <Path d="M16 102 C18 74 32 68 50 68 C68 68 82 74 84 102 Z" fill="#1F2937" />
          <Path d="M40 68 L50 90 L60 68 Z" fill="#F8FAFC" />
          <Path d="M48 72 L52 72 L53 90 L50 94 L47 90 Z" fill="#1B7F5C" />
          {/* Lapels */}
          <Path d="M36 68 L48 92 L34 84 Z" fill="#2A3648" />
          <Path d="M64 68 L52 92 L66 84 Z" fill="#2A3648" />
          {/* Neck & head */}
          <Rect x={44} y={56} width={12} height={16} rx={5} fill="#C68B65" />
          <Circle cx={50} cy={43} r={17} fill="#D99B72" />
          {/* Tailored hair */}
          <Path
            d="M32 42 C32 27 42 22 51 22 C62 22 68 29 68 41 C65 34 58 31 48 32 C41 33 35 37 32 42 Z"
            fill="#1D222B"
          />
          <Circle cx={50} cy={50} r={48} stroke="rgba(255,255,255,0.14)" strokeWidth={2} fill="none" />
        </>
      );

    case 'prof_glasses':
      return (
        <>
          <Rect x={0} y={0} width={100} height={100} fill="#1D2B44" />
          <Circle cx={28} cy={24} r={30} fill="#2C446E" opacity={0.6} />
          <Circle cx={80} cy={76} r={26} fill="#38BDF8" opacity={0.16} />
          {/* Knitwear & collar */}
          <Path d="M16 102 C19 75 34 70 50 70 C66 70 81 75 84 102 Z" fill="#0F766E" />
          <Path d="M41 68 C45 73 55 73 59 68 L59 75 C55 80 45 80 41 75 Z" fill="#115E59" />
          {/* Neck & face */}
          <Rect x={44} y={57} width={12} height={15} rx={5} fill="#DFAA86" />
          <Circle cx={50} cy={43} r={16.5} fill="#ECC09E" />
          {/* Hair */}
          <Path
            d="M32 43 C32 26 44 21 53 23 C63 24 68 32 67 42 C63 36 57 33 49 33 C42 33 36 37 32 43 Z"
            fill="#2B2523"
          />
          {/* Minimalist round spectacles */}
          <Circle cx={43.5} cy={44} r={5.4} stroke="#1F242D" strokeWidth={2} fill="rgba(255,255,255,0.14)" />
          <Circle cx={56.5} cy={44} r={5.4} stroke="#1F242D" strokeWidth={2} fill="rgba(255,255,255,0.14)" />
          <Path d="M48.9 44 L51.1 44" stroke="#1F242D" strokeWidth={1.8} />
          <Circle cx={50} cy={50} r={48} stroke="rgba(255,255,255,0.14)" strokeWidth={2} fill="none" />
        </>
      );

    case 'prof_minimal':
      return (
        <>
          <Rect x={0} y={0} width={100} height={100} fill="#E8DDD0" />
          <Path d="M22 100 L22 46 C22 25 78 25 78 46 L78 100 Z" fill="#D5C2AE" />
          <Circle cx={74} cy={26} r={11} fill="#C66B49" opacity={0.85} />
          {/* Minimalist terracotta blazer */}
          <Path d="M18 102 C20 76 34 70 50 70 C66 70 80 76 82 102 Z" fill="#22303C" />
          <Path d="M43 70 L50 84 L57 70 Z" fill="#F6F1EA" />
          <Rect x={44} y={56} width={12} height={16} rx={5} fill="#B97B57" />
          <Circle cx={50} cy={42} r={16} fill="#C98A63" />
          <Path
            d="M34 40 C34 26 44 23 50 23 C58 23 66 28 66 40 C60 35 40 35 34 40 Z"
            fill="#1D1C1A"
          />
        </>
      );

    case 'prof_hijab':
      return (
        <>
          <Rect x={0} y={0} width={100} height={100} fill="#13313D" />
          <Circle cx={76} cy={24} r={22} fill="#1E5263" opacity={0.75} />
          <Circle cx={24} cy={80} r={24} fill="#D49B4B" opacity={0.18} />
          {/* Outer drape */}
          <Path
            d="M17 102 C18 72 28 60 36 46 C38 28 43 22 50 22 C57 22 62 28 64 46 C72 60 82 72 83 102 Z"
            fill="#1D7A75"
          />
          {/* Inner cream trim & face oval */}
          <Ellipse cx={50} cy={43} rx={14.5} ry={17} fill="#E6C7A8" />
          {/* Gold accent fold */}
          <Path
            d="M33 64 C40 76 60 76 67 64 C66 74 58 84 50 84 C42 84 34 74 33 64 Z"
            fill="#155D59"
          />
          <Circle cx={50} cy={50} r={48} stroke="rgba(255,255,255,0.14)" strokeWidth={2} fill="none" />
        </>
      );

    case 'sea_palm':
      return (
        <>
          <Rect x={0} y={0} width={100} height={100} fill="#1D2F4F" />
          {/* Sunset gradient bands */}
          <Rect x={0} y={32} width={100} height={36} fill="#B84B47" opacity={0.72} />
          <Rect x={0} y={48} width={100} height={24} fill="#E88B4D" opacity={0.85} />
          {/* Warm tropical sun */}
          <Circle cx={54} cy={54} r={19} fill="#FCD34D" />
          {/* Sea & golden shimmer */}
          <Rect x={0} y={66} width={100} height={36} fill="#0F4C5C" />
          <Path d="M0 70 Q25 66 50 70 T100 70 L100 100 L0 100 Z" fill="#136377" />
          <Ellipse cx={54} cy={72} rx={16} ry={2.2} fill="#FDE68A" opacity={0.78} />
          <Ellipse cx={54} cy={79} rx={10} ry={1.6} fill="#FCD34D" opacity={0.62} />
          {/* Twin coconut palms silhouette */}
          <Path d="M22 102 Q24 72 34 38" stroke="#0C1924" strokeWidth={4.2} fill="none" />
          <Path d="M34 38 Q16 32 10 44 Q22 39 34 38 Z" fill="#0C1924" />
          <Path d="M34 38 Q22 20 14 24 Q26 28 34 38 Z" fill="#0C1924" />
          <Path d="M34 38 Q38 18 52 24 Q42 30 34 38 Z" fill="#0C1924" />
          <Path d="M34 38 Q48 34 52 46 Q41 41 34 38 Z" fill="#0C1924" />
          <Path d="M84 102 Q81 78 73 52" stroke="#0C1924" strokeWidth={3.4} fill="none" />
          <Path d="M73 52 Q59 46 54 56 Q64 52 73 52 Z" fill="#0C1924" />
          <Path d="M73 52 Q70 36 82 36 Q78 44 73 52 Z" fill="#0C1924" />
          <Path d="M73 52 Q86 46 94 56 Q83 53 73 52 Z" fill="#0C1924" />
        </>
      );

    case 'sea_lotus':
      return (
        <>
          <Rect x={0} y={0} width={100} height={100} fill="#0D2F28" />
          <Circle cx={50} cy={40} r={34} fill="#144A3F" opacity={0.75} />
          {/* Water ripples */}
          <Ellipse cx={50} cy={70} rx={38} ry={8} stroke="#5EEAD4" strokeWidth={1.2} opacity={0.3} fill="none" />
          <Ellipse cx={50} cy={74} rx={27} ry={5} stroke="#5EEAD4" strokeWidth={1.2} opacity={0.45} fill="none" />
          {/* Emerald lily pad */}
          <Path d="M16 69 A34 11 0 1 0 84 69 L50 67 Z" fill="#1F7A5A" />
          {/* Sacred Bengal Shapla / Lotus petals */}
          <Path d="M50 66 C34 62 24 48 28 36 C36 42 44 52 50 66 Z" fill="#F472B6" />
          <Path d="M50 66 C66 62 76 48 72 36 C64 42 56 52 50 66 Z" fill="#F472B6" />
          <Path d="M50 66 C38 56 36 38 40 28 C46 36 49 48 50 66 Z" fill="#FBCFE8" />
          <Path d="M50 66 C62 56 64 38 60 28 C54 36 51 48 50 66 Z" fill="#FBCFE8" />
          <Path d="M50 66 C42 50 43 32 50 20 C57 32 58 50 50 66 Z" fill="#FFF1F5" />
          <Circle cx={50} cy={49} r={4} fill="#FBBF24" />
        </>
      );

    case 'sea_monstera':
      return (
        <>
          <Rect x={0} y={0} width={100} height={100} fill="#F2ECE1" />
          {/* Warm tropical terracotta sun */}
          <Circle cx={64} cy={38} r={24} fill="#DF724E" />
          <Circle cx={28} cy={74} r={18} fill="#D5C8B4" opacity={0.6} />
          {/* Monstera leaf silhouette with signature ribs */}
          <Path
            d="M48 88 L49 74 C28 74 18 58 20 42 C25 44 33 44 38 41 C28 36 23 26 27 18 C34 22 41 25 46 28 C45 19 47 12 52 10 C59 12 62 20 60 28 C66 24 74 20 80 18 C82 26 77 36 67 41 C73 43 80 42 84 40 C86 56 75 73 53 74 L54 88 Z"
            fill="#14533C"
          />
          <Path d="M50 74 L51 24" stroke="#348F68" strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M51 58 L31 53" stroke="#348F68" strokeWidth={1.6} strokeLinecap="round" />
          <Path d="M51 44 L36 33" stroke="#348F68" strokeWidth={1.6} strokeLinecap="round" />
          <Path d="M51 56 L71 52" stroke="#348F68" strokeWidth={1.6} strokeLinecap="round" />
          <Path d="M51 42 L68 32" stroke="#348F68" strokeWidth={1.6} strokeLinecap="round" />
        </>
      );

    case 'sea_boat':
      return (
        <>
          <Rect x={0} y={0} width={100} height={100} fill="#2A233E" />
          <Rect x={0} y={38} width={100} height={26} fill="#7B435B" />
          <Circle cx={50} cy={54} r={16} fill="#F59E0B" />
          {/* Calm Padma / Mekong river */}
          <Rect x={0} y={62} width={100} height={40} fill="#183A4A" />
          <Ellipse cx={50} cy={66} rx={22} ry={2} fill="#FCD34D" opacity={0.55} />
          {/* Wooden country boat (নৌকা) */}
          <Path d="M22 64 Q50 77 78 64 L71 71 Q50 78 29 71 Z" fill="#0F172A" />
          {/* Canopy / ছই */}
          <Path d="M39 65 Q50 51 61 65 Z" fill="#C2593F" />
          {/* Gentle wave */}
          <Path d="M0 80 Q25 75 50 80 T100 80 L100 102 L0 102 Z" fill="#122B37" />
        </>
      );

    case 'abs_prism':
      return (
        <>
          <Rect x={0} y={0} width={100} height={100} fill="#141824" />
          <Circle cx={68} cy={30} r={20} fill="#F59E0B" />
          <Path d="M0 100 L52 34 L100 100 Z" fill="#2563EB" opacity={0.92} />
          <Path d="M0 100 L52 34 L38 100 Z" fill="#60A5FA" opacity={0.5} />
          <Rect x={58} y={60} width={28} height={28} rx={14} fill="#F8F5EE" opacity={0.92} />
          <Circle cx={50} cy={50} r={48} stroke="rgba(255,255,255,0.12)" strokeWidth={2} fill="none" />
        </>
      );

    case 'abs_aura':
      return (
        <>
          <Rect x={0} y={0} width={100} height={100} fill="#17122B" />
          <Circle cx={30} cy={30} r={34} fill="#6D28D9" opacity={0.55} />
          <Circle cx={74} cy={68} r={34} fill="#0D9488" opacity={0.6} />
          <Circle cx={54} cy={48} r={24} fill="#F43F5E" opacity={0.42} />
          <Circle cx={50} cy={50} r={22} stroke="rgba(255,255,255,0.28)" strokeWidth={1.6} fill="none" />
          <Circle cx={50} cy={50} r={34} stroke="rgba(255,255,255,0.14)" strokeWidth={1.2} fill="none" />
          <Circle cx={50} cy={50} r={10} fill="#FDE68A" opacity={0.9} />
        </>
      );

    case 'abs_terracotta':
      return (
        <>
          <Rect x={0} y={0} width={100} height={100} fill="#EFE6DC" />
          <Path d="M0 54 L54 0 L100 0 L100 100 L0 100 Z" fill="#E3D4C3" />
          {/* Warm arch */}
          <Path d="M24 102 L24 54 A26 26 0 0 1 76 54 L76 102 Z" fill="#B85335" />
          {/* Inner sage arch */}
          <Path d="M38 102 L38 64 A12 12 0 0 1 62 64 L62 102 Z" fill="#1F5E4B" />
          {/* Floating sun */}
          <Circle cx={72} cy={26} r={10} fill="#D97706" />
        </>
      );

    case 'abs_mosaic':
      return (
        <>
          <Rect x={0} y={0} width={100} height={100} fill="#102921" />
          <Rect x={0} y={0} width={50} height={50} fill="#174939" />
          <Rect x={50} y={50} width={50} height={50} fill="#1C5D49" />
          <Circle cx={25} cy={25} r={17} fill="#E7C266" />
          <Path d="M50 0 L100 0 L50 50 Z" fill="#D95F43" />
          <Circle cx={75} cy={75} r={16} fill="#F4F1EA" />
          <Path d="M0 50 L50 50 L50 100 A50 50 0 0 1 0 50 Z" fill="#0F766E" />
          <Circle cx={50} cy={50} r={48} stroke="rgba(255,255,255,0.12)" strokeWidth={2} fill="none" />
        </>
      );
  }
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
