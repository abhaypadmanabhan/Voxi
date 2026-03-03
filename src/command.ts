interface CommandInput {
  instruction: string;
  clipboardContent?: string;
  appName?: string;
}

interface CommandOutput {
  mode: 'stub';
  instruction: string;
  clipboardContent?: string;
  appName?: string;
}

export function handleCommand(input: CommandInput): CommandOutput {
  return {
    mode: 'stub',
    instruction: input.instruction,
    clipboardContent: input.clipboardContent,
    appName: input.appName
  };
}
