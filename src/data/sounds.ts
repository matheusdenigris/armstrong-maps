/**
 * Sound recorded on Mars.
 *
 * The file is the MP3 that NASA publishes, unchanged, kept in `public/audio` so it plays without
 * depending on another server. It was recorded at Jezero crater; the visor plays it at every
 * site and says where it is from.
 */
export const MARS_WIND = {
  /** Served from the app's own `public` folder. */
  url: '/audio/perseverance-supercam-wind-sol004.mp3',
  title: 'Wind on Mars, recorded by the SuperCam microphone of Perseverance',
  when: 'sol 4 (22 February 2021)',
  /** The site where it was recorded. */
  site: 'jezero',
  seconds: 40,
  credit: 'NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero',
  source: 'https://science.nasa.gov/resource/perseverance-rovers-supercam-records-wind-on-mars/',
} as const;
