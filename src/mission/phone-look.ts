/**
 * Looking around by turning the phone: where the back of the phone points, from what its motion
 * sensors report.
 *
 * A browser gives three angles (alpha about the vertical, beta front to back, gamma side to
 * side). Read one by one they jump when the phone is held upright, which is exactly how a visor
 * is held, so they are turned into the direction the back of the phone points instead, as a
 * window would be looked through. That direction is steady however the phone is held, upright
 * or on its side.
 *
 * Only the change since the phone look was switched on is used. Mars has no global magnetic
 * field, and the angle a browser reports is not a compass reading everywhere on Earth either,
 * so this never claims a real heading: it turns the view by as much as the phone turned.
 */

export type PhoneAngles = {
  /** Rotation about the vertical, in degrees, growing counter-clockwise seen from above. */
  alpha: number;
  /** Front to back, in degrees: 0 flat on a table, 90 standing upright. */
  beta: number;
  /** Side to side, in degrees. */
  gamma: number;
};

export type PhoneDirection = {
  /** Which way the back of the phone points, in degrees clockwise from the sensor's zero. */
  heading: number;
  /** How far above the horizontal it points, in degrees. Negative is down. */
  pitch: number;
};

const RAD = Math.PI / 180;

/** The direction the back of the phone points. */
export function phoneDirection({ alpha, beta, gamma }: PhoneAngles): PhoneDirection {
  const [sa, ca] = [Math.sin(alpha * RAD), Math.cos(alpha * RAD)];
  const [sb, cb] = [Math.sin(beta * RAD), Math.cos(beta * RAD)];
  const [sg, cg] = [Math.sin(gamma * RAD), Math.cos(gamma * RAD)];
  // The axis out of the back of the phone, in a frame with x east, y north and z up, for a
  // rotation about z, then x, then y, which is the order the angles are defined in.
  const east = -ca * sg - sa * sb * cg;
  const north = -sa * sg + ca * sb * cg;
  const up = -cb * cg;
  const heading = (Math.atan2(east, north) / RAD + 360) % 360;
  return { heading, pitch: Math.asin(Math.max(-1, Math.min(1, up))) / RAD };
}

/** The turn from one heading to another, the short way round: -180 to 180, positive clockwise. */
const shortTurn = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

/**
 * How far the head has turned and tilted since `zero`, the way the phone was held when the phone
 * look was switched on. Pointing straight up or down has no heading, so there the turn is left
 * as it was (`lastYaw`).
 */
export function lookSince(
  zero: PhoneAngles,
  now: PhoneAngles,
  lastYaw = 0,
): { yaw: number; pitch: number } {
  const from = phoneDirection(zero);
  const to = phoneDirection(now);
  const steep = Math.abs(to.pitch) > 80 || Math.abs(from.pitch) > 80;
  return {
    yaw: steep ? lastYaw : shortTurn(from.heading, to.heading),
    pitch: to.pitch - from.pitch,
  };
}

/** Whether a reading from the sensors is one to use: a phone without them reports nulls. */
export function isReading(angles: {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
}): angles is PhoneAngles {
  return (
    typeof angles.alpha === 'number' &&
    typeof angles.beta === 'number' &&
    typeof angles.gamma === 'number' &&
    Number.isFinite(angles.alpha + angles.beta + angles.gamma)
  );
}
