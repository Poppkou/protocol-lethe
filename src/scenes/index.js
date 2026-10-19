// Порядок сцен. manual: true — в сцену попадают только явным переходом (концовки).
import { warning, onboarding, calibration } from './intro.js';
import { scan, photo, voices1, dirt, voices2 } from './early.js';
import { quiet, warm, knock } from './mid.js';
import { consent, purge, camera, dead } from './climax.js';
import { final, endA, endB, endC, credits, idleA, after } from './final.js';

export const SCENES = [
  warning,
  onboarding,
  calibration,
  scan,
  photo,
  voices1,
  dirt,
  voices2,
  quiet,
  warm,
  knock,
  consent,
  purge,
  camera,
  dead,
  final,
  endA,
  endB,
  endC,
  credits,
  idleA,
  after,
];
