import { useEffect, useState } from 'react';

import frame1 from './Waveform 2.svg';
import frame2 from './Waveform 3.svg';
import frame3 from './Waveform 4.svg';
import frame4 from './Waveform 5.svg';
import frame5 from './Waveform 6.svg';
import frame6 from './Waveform 7.svg';

const FRAMES = [frame1, frame2, frame3, frame4, frame5, frame6];

const WaveformLoader = () => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length);
    }, 300); // ~5fps
    return () => clearInterval(id);
  }, []);

  return (
    <img
      src={FRAMES[frame]}
      alt=""
      className="w-full max-w-sm opacity-80"
      draggable={false}
    />
  );
};

export default WaveformLoader;
