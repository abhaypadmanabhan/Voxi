import { z } from 'zod';

export const ContextMessageSchema = z.object({
  type: z.literal('context'),
  appName: z.string().min(1),
  vocabulary: z.array(z.string()).optional(),
  skipFormatter: z.boolean().optional()
});

export const AudioChunkMessageSchema = z.object({
  type: z.literal('audio_chunk'),
  data: z.string().min(1)
});

export const EndStreamMessageSchema = z.object({
  type: z.literal('end_stream')
});

export const CommandMessageSchema = z.object({
  type: z.literal('command'),
  instruction: z.string().min(1),
  clipboardContent: z.string().optional()
});

export const ClientMessageSchema = z.discriminatedUnion('type', [
  ContextMessageSchema,
  AudioChunkMessageSchema,
  EndStreamMessageSchema,
  CommandMessageSchema
]);

export type ContextMessage = z.infer<typeof ContextMessageSchema>;
export type AudioChunkMessage = z.infer<typeof AudioChunkMessageSchema>;
export type EndStreamMessage = z.infer<typeof EndStreamMessageSchema>;
export type CommandMessage = z.infer<typeof CommandMessageSchema>;
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export type ServerMessage =
  | { type: 'token'; data: string }
  | { type: 'done'; data: string }
  | { type: 'error'; data: string }
  | { type: 'raw_transcript'; data: string }
  | {
      type: 'command_result';
      data: {
        mode: 'stub';
        instruction: string;
        clipboardContent?: string;
        appName?: string;
      };
    };

export interface WsSessionState {
  appName?: string;
  isContextSet: boolean;
  audioChunks: Buffer[];
  vocabulary: string[];
  skipFormatter?: boolean;
}
