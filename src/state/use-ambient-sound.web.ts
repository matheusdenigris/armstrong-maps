import { useEffect, useRef, useState } from 'react';

export const AMBIENT_SOUND_AVAILABLE = true;

/** Plays one recording on a loop, at the volume it was published with. */
class LoopPlayer {
  private context: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  async start() {
    this.context ??= new AudioContext();
    await this.context.resume();
    if (!this.buffer) {
      const response = await fetch(this.url);
      if (!response.ok) throw new Error(`The recording answered ${response.status}`);
      this.buffer = await this.context.decodeAudioData(await response.arrayBuffer());
    }
    this.stop();
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.loop = true;
    source.connect(this.context.destination);
    source.start();
    this.source = source;
  }

  stop() {
    this.source?.stop();
    this.source = null;
  }

  close() {
    this.stop();
    void this.context?.close();
    this.context = null;
  }
}

/**
 * A recording that the screen can switch on and off. A browser only lets sound start from a
 * press, so nothing plays until `toggle` is called from one.
 */
export function useAmbientSound(url: string) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const player = useRef<LoopPlayer | null>(null);

  useEffect(() => {
    const created = new LoopPlayer(url);
    player.current = created;
    return () => {
      created.close();
      player.current = null;
    };
  }, [url]);

  async function toggle() {
    const current = player.current;
    if (!current) return;
    if (playing) {
      current.stop();
      setPlaying(false);
      return;
    }
    try {
      await current.start();
      setFailed(false);
      setPlaying(true);
    } catch {
      setFailed(true);
      setPlaying(false);
    }
  }

  return { playing, failed, toggle };
}
