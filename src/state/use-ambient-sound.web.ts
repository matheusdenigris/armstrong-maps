import { useEffect, useRef, useState } from 'react';

export const AMBIENT_SOUND_AVAILABLE = true;

/**
 * How much louder than published the recording is played. The wind of Mars is faint: the air is
 * about a hundredth as dense as on Earth, and the published file is quiet. A limiter after the
 * gain keeps the gusts from distorting.
 */
const GAIN = 6;

/** Plays one recording on a loop, louder than it was published. */
class LoopPlayer {
  private context: AudioContext | null = null;
  private output: AudioNode | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  async start() {
    this.context ??= new AudioContext();
    if (!this.output) {
      const louder = this.context.createGain();
      louder.gain.value = GAIN;
      const limiter = this.context.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      louder.connect(limiter);
      limiter.connect(this.context.destination);
      this.output = louder;
    }
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
    source.connect(this.output);
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
    this.output = null;
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
