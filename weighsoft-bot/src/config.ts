import 'dotenv/config';
import { z } from 'zod';

const ConfigSchema = z.object({
  EXCEL_PATH: z.string().default('./data/register.xlsx'),
  EXCEL_SHEET: z.string().default('Sheet1'),
  HEADER_ROW: z.coerce.number().default(1),
  GROUP_NAME: z.string().default('WeighSoft Technicians'),
  SESSION_PATH: z.string().default('./sessions'),
  CHECK_PREFIX: z.string().default('check'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

/** Validated application configuration from environment variables. */
export const config = ConfigSchema.parse(process.env);

export type Config = z.infer<typeof ConfigSchema>;
