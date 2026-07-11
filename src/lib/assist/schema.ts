import { z } from 'zod';

/**
 * Strict schema for an interpreted accessibility command.
 *
 * The model returns ONLY structured intent that matches this schema. There is no
 * field for selectors, CSS, JavaScript, URLs, or arbitrary text to execute — those
 * simply do not exist here, so the model cannot smuggle them through. `.strict()`
 * rejects any unknown key. Every numeric is bounded and every string enum is closed.
 *
 * The actual CSS/DOM transformations are predefined in the extension; this object only
 * says WHICH predefined adaptation to toggle and at what (bounded) intensity.
 */

const intensities = z
  .object({
    colorMode: z.number().min(0).max(1),
    darkMode: z.number().min(0).max(1),
    highContrast: z.number().min(0).max(1),
    warmTone: z.number().min(0).max(1),
    invertColors: z.number().min(0).max(1),
    blur: z.number().min(0).max(1),
    zoom: z.number().min(0).max(1),
    dimOverlay: z.number().min(0).max(1),
  })
  .partial()
  .strict();

export const CommandSchema = z
  .object({
    // ---- Assist Mode: readability ----
    textScale: z.number().min(1).max(2.5).nullable().optional(),
    lineSpacing: z.number().min(0).max(2.6).nullable().optional(),
    letterSpacing: z.number().min(0).max(0.2).nullable().optional(),
    paraSpacing: z.number().min(0).max(3).nullable().optional(),
    boldText: z.boolean().nullable().optional(),
    // ---- Assist Mode: visual comfort ----
    highContrast: z.boolean().nullable().optional(),
    darkMode: z.boolean().nullable().optional(),
    dimOverlay: z.boolean().nullable().optional(),
    warmTone: z.boolean().nullable().optional(),
    reduceMotion: z.boolean().nullable().optional(),
    brightness: z.number().min(0.1).max(1.5).nullable().optional(),
    invertColors: z.boolean().nullable().optional(),
    // ---- Assist Mode: focus / structure ----
    focusHighlight: z.boolean().nullable().optional(),
    simplify: z.boolean().nullable().optional(),
    reposition: z.enum(['left', 'right', 'center']).nullable().optional(),
    colorDistinction: z.boolean().nullable().optional(),
    readAloud: z.enum(['start', 'stop']).nullable().optional(),
    find: z.string().max(120).nullable().optional(),
    // ---- Developer Simulation Mode (explicit requests only) ----
    colorMode: z.enum(['deuteranopia', 'protanopia', 'tritanopia', 'achromatopsia']).nullable().optional(),
    hemianopia: z.enum(['left', 'right']).nullable().optional(),
    zoom: z.enum(['center', 'peripheral', 'full']).nullable().optional(),
    blur: z.boolean().nullable().optional(),
    // ---- intensities + control/meta ----
    intensities: intensities.nullable().optional(),
    reset: z.boolean().default(false),
    undo: z.boolean().nullable().optional(),
    needsClarification: z.boolean().nullable().optional(),
    confidence: z.number().min(0).max(1).nullable().optional(),
    explanation: z.string().max(240).optional().default(''),
  })
  .strict();

export type Command = z.infer<typeof CommandSchema>;

/** Fields whose presence (non-null) means the command actually does something. */
const ACTION_KEYS: (keyof Command)[] = [
  'textScale', 'lineSpacing', 'letterSpacing', 'paraSpacing', 'boldText',
  'highContrast', 'darkMode', 'dimOverlay', 'warmTone', 'reduceMotion', 'brightness',
  'invertColors', 'focusHighlight', 'simplify', 'reposition', 'colorDistinction',
  'readAloud', 'find', 'colorMode', 'hemianopia', 'zoom', 'blur', 'intensities',
];

export function isActionable(cmd: Command): boolean {
  if (cmd.reset || cmd.undo) return true;
  return ACTION_KEYS.some((k) => cmd[k] !== null && cmd[k] !== undefined);
}
