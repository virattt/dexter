import React from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../theme.js';
import clipboard from 'clipboardy';
import { JSX } from 'react';

interface CopyConfirmProps {
  onConfirm: (wantsToCopy: boolean) => void;
}

/**
 * Returns JSX that asks user whether the AI response text gets copied to clipboard or not
 * @param onConfirm - arrow function of type 'void' that determines what happens for 'y' and 'n'
 * @returns JSX.Element
 */
export function CopyConfirm({ onConfirm }: CopyConfirmProps) {
  useInput((input) => {
    const key = input.toLowerCase();
    if (key === 'y') {
      onConfirm(true);
    } else if (key === 'n') {
      onConfirm(false);
    }
    // Silently ignore other keys (don't trigger onConfirm)
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.primary} bold>
        Copy to clipboard?
      </Text>
      <Text>
        Would you like to copy the AI research result? <Text color={colors.muted}>(y/n)</Text>
      </Text>
    </Box>
  );
}

interface CopyToClipboardProps{
    text: string;
    onComplete: () => void;
}
/**
 * Returns component 'CopyConfirm()' and puts AI response text to clipboard if param 'onConfirm' from 'CopyConfirm()' is 'true', no consequence for 'false'
 * Returns extra JSX if error occurs during copying
 * @params text - the AI response text
 * @returns JSX.Element
 */
export function CopyToClipboard({ text, onComplete }: CopyToClipboardProps): JSX.Element {
    const [error, setError] = React.useState<string | null>(null);
    const [isCopying, setIsCopying] = React.useState<boolean>(false);
    const [success, setSuccess] = React.useState<boolean>(false);

    const handleConfirm = async (wantsToCopy: boolean) => {
    if (wantsToCopy) {
      try {
        setIsCopying(true);
        await clipboard.write(text);
        setSuccess(true);
        // Call onComplete after showing success for ~500ms
        setTimeout(() => onComplete(), 500);
      } catch (err) {
        setError('Clipboard unavailable');
        // Still call onComplete even on error
        setTimeout(() => onComplete(), 1000);
      } finally {
        setIsCopying(false);
      }
    } else {
      // User pressed 'n' - dismiss immediately
      onComplete();
    }
  };

    return (
        <>
            <CopyConfirm onConfirm={handleConfirm} />
            {isCopying && (
                <Box marginTop={1}>
                    <Text color="red">Copying AI response...</Text>
                </Box>
            )}
            {error && (
                <Box marginTop={1}>
                    <Text color="red">{error}</Text>
                </Box>
            )}
            {success && (
                <Box marginTop={1}>
                    <Text color="red">Copied AI response.</Text>
                </Box>
            )}
        </>
    );
}