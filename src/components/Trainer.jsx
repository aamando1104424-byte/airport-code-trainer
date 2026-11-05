import { useEffect, useRef } from 'react';
import { mountTrainer } from '../trainer/engine';

// Hosts the game engine. It mounts once; the bridge reads live React state through refs.
export default function Trainer({ bridge }) {
  const host = useRef(null);
  useEffect(() => mountTrainer(host.current, bridge), []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={host} />;
}
