import { useMemo } from 'react';
import { motion } from 'framer-motion';

const sizeMap = { sm: 48, md: 80, lg: 120 };
const BRAND = { primary: '#F45513', accent: '#FF7A45', dark: '#C43E0A' };
const LOGO =
  'M17.2344 0C17.8295 2.6016e-08 18.3125 0.484511 18.3125 1.08203V5.71094H5.6875V15.1543L11.5518 18.3564L11.6934 18.4326C11.8194 18.5004 11.9024 18.5425 11.9678 18.5703C11.9806 18.5758 11.9915 18.5798 12 18.583C12.0084 18.5799 12.0187 18.5756 12.0313 18.5703C12.0966 18.5425 12.1796 18.5004 12.3057 18.4326L12.4473 18.3564L18.3125 15.1543V5.71094H23.4609C23.7585 5.71094 24 5.95321 24 6.25195V13.2021C24 13.5996 23.7828 13.9653 23.4346 14.1543L20.4092 15.7939C20.3986 15.8012 20.3899 15.8116 20.3789 15.8184L20.3438 15.8379L13.2012 19.7373L13.0576 19.8154C12.915 19.8922 12.7762 19.9638 12.6475 20.0186C12.4656 20.0959 12.2507 20.164 12 20.1641C11.7491 20.1641 11.5336 20.096 11.3516 20.0186C11.2229 19.9638 11.0839 19.8922 10.9414 19.8154L10.7979 19.7373L3.65527 15.8379C3.6265 15.8222 3.59923 15.8048 3.57324 15.7861L0.56543 14.1543C0.217168 13.9653 -1.73729e-08 13.5996 0 13.2021V6.25195C3.75906e-05 5.95321 0.241487 5.71094 0.539063 5.71094H5.6875V1.08203C5.68754 0.484511 6.17045 -2.60138e-08 6.76563 0H17.2344Z';

const CK = 'M4 11L9.5 16.5L20 4.5';

function mkBurst(cx, cy, count) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return {
      x: Math.cos(a) * 14,
      y: Math.sin(a) * 14,
      s: 1 + Math.random() * 1.5,
    };
  });
}

export function DownloadPulse({ size = 'md', color = BRAND.primary }) {
  const d = sizeMap[size],
    h = (d * 21) / 24;
  const fid = useMemo(() => 'pf' + Math.random().toString(36).slice(2, 7), []);
  return (
    <svg width={d} height={h} viewBox="-4 -4 32 29" fill="none">
      <defs>
        <filter id={fid} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
        </filter>
      </defs>
      <motion.ellipse
        cx="12"
        cy="10.5"
        rx="14"
        ry="12"
        fill={color}
        filter={'url(#' + fid + ')'}
        animate={{ opacity: [0.08, 0.22, 0.08], scale: [0.9, 1.05, 0.9] }}
        transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
        style={{ transformOrigin: '12px 10.5px' }}
      />
      <motion.g
        animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
        style={{ transformOrigin: '12px 10.5px' }}
      >
        <path d={LOGO} fill={color} />
      </motion.g>
    </svg>
  );
}

export function DownloadBounce({ size = 'md', color = BRAND.primary }) {
  const d = sizeMap[size],
    h = (d * 28) / 24;
  return (
    <svg width={d} height={h} viewBox="0 -2 24 28" fill="none">
      <motion.g
        animate={{ y: [0, 4, 0] }}
        transition={{
          duration: 1.2,
          ease: [0.45, 0, 0.15, 1],
          repeat: Infinity,
        }}
      >
        <path d={LOGO} fill={color} />
      </motion.g>
      <line
        x1="2"
        y1="24"
        x2="22"
        y2="24"
        stroke={color}
        strokeWidth="0.6"
        strokeLinecap="round"
        opacity="0.4"
      />
      {[0, 1].map((i) => (
        <motion.ellipse
          key={i}
          cx="12"
          cy="24"
          stroke={color}
          strokeWidth="0.4"
          fill="none"
          initial={{ rx: 3, ry: 0.8, opacity: 0.5 }}
          animate={{ rx: [3, 10], ry: [0.8, 2.5], opacity: [0.5, 0] }}
          transition={{
            duration: 1.2,
            ease: 'easeOut',
            repeat: Infinity,
            delay: i * 0.15,
          }}
        />
      ))}
    </svg>
  );
}

export function DownloadProgress({ size = 'md', color = BRAND.primary }) {
  const d = sizeMap[size],
    h = (d * 21) / 24;
  const cid = useMemo(() => 'cp' + Math.random().toString(36).slice(2, 7), []);
  const sid = useMemo(() => 'cs' + Math.random().toString(36).slice(2, 7), []);
  return (
    <svg width={d} height={h} viewBox="0 0 24 21" fill="none">
      <defs>
        <clipPath id={cid}>
          <path d={LOGO} />
        </clipPath>
        <linearGradient id={sid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0.25" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={LOGO} fill={color} opacity="0.15" />
      <g clipPath={'url(#' + cid + ')'}>
        <motion.rect
          x="0"
          width="24"
          height="21"
          fill={color}
          animate={{ y: [21, 0, 0, 21] }}
          transition={{
            duration: 2.8,
            times: [0, 0.75, 0.85, 0.88],
            ease: 'easeInOut',
            repeat: Infinity,
          }}
        />
        <motion.rect
          x="-6"
          y="0"
          width="6"
          height="21"
          fill={'url(#' + sid + ')'}
          animate={{ x: [-6, 30, 30] }}
          transition={{
            duration: 2.8,
            times: [0.5, 0.8, 1],
            ease: 'easeInOut',
            repeat: Infinity,
          }}
        />
      </g>
    </svg>
  );
}

export function DownloadOrbit({ size = 'md', color = BRAND.primary }) {
  const d = sizeMap[size],
    h = (d * 21) / 24;
  const ps = [
    { r: 14, sz: 1.4, dur: 2.8, dl: 0 },
    { r: 14, sz: 1, dur: 2.8, dl: 0.9 },
    { r: 14, sz: 1.8, dur: 2.8, dl: 1.8 },
    { r: 11, sz: 0.8, dur: 3.4, dl: 0.4 },
  ];
  return (
    <svg width={d} height={h} viewBox="-6 -6 36 33" fill="none">
      <path d={LOGO} fill={color} />
      {ps.map((p, i) => (
        <motion.g
          key={i}
          animate={{ rotate: 360 }}
          transition={{
            duration: p.dur,
            ease: 'linear',
            repeat: Infinity,
            delay: p.dl,
          }}
          style={{ transformOrigin: '12px 10.5px' }}
        >
          <motion.circle
            cx={12 + p.r}
            cy="10.5"
            r={p.sz}
            fill={BRAND.accent}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: p.dur / 2, repeat: Infinity }}
          />
        </motion.g>
      ))}
    </svg>
  );
}

export function DownloadStream({ size = 'md', color = BRAND.primary }) {
  const d = sizeMap[size],
    h = (d * 28) / 24;
  const pkts = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        x: 10 + Math.sin(i * 1.2) * 4 + (i % 3) * 1.2,
        w: 1.2 + (i % 3) * 0.4,
        ph: 2.5 + (i % 2) * 1,
        dl: i * 0.25,
        dur: 1.2 + (i % 3) * 0.2,
      })),
    [],
  );
  return (
    <svg width={d} height={h} viewBox="0 -10 24 31" fill="none">
      <motion.g
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 0.1 }}
        style={{ transformOrigin: '12px 10.5px' }}
      >
        <path d={LOGO} fill={color} />
      </motion.g>
      {pkts.map((p, i) => (
        <motion.rect
          key={i}
          x={p.x}
          width={p.w}
          height={p.ph}
          rx="0.5"
          fill={BRAND.accent}
          animate={{ y: [-12, 2], opacity: [0, 0.9, 0.9, 0] }}
          transition={{
            duration: p.dur,
            ease: 'easeIn',
            repeat: Infinity,
            delay: p.dl,
            times: [0, 0.2, 0.7, 1],
          }}
        />
      ))}
    </svg>
  );
}

export function DownloadComplete({ size = 'md', color = BRAND.primary }) {
  const d = sizeMap[size],
    h = (d * 21) / 24;
  const bp = useMemo(() => mkBurst(12, 10.5, 10), []);

  return (
    <svg width={d} height={h} viewBox="-4 -4 32 29" fill="none">
      <motion.path
        d={CK}
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      />
      {bp.map((p, i) => (
        <motion.circle
          key={i}
          cx="12"
          cy="10.5"
          r={p.s}
          fill={BRAND.accent}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
        />
      ))}
    </svg>
  );
}
