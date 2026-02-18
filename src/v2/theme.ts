import type { EditorTheme, MarkdownTheme, SelectListTheme } from '@mariozechner/pi-tui';
import chalk from 'chalk';

const palette = {
  primary: '#258bff',
  primaryLight: '#a5cfff',
  success: 'green',
  error: 'red',
  warning: 'yellow',
  muted: '#a6a6a6',
  mutedDark: '#303030',
  accent: 'cyan',
  white: '#ffffff',
  info: '#6CB6FF',
  queryBg: '#3D3D3D',
  border: '#303030',
};

const fg = (color: string) => (text: string) => chalk.hex(color)(text);
const bg = (color: string) => (text: string) => chalk.bgHex(color)(text);

export const theme = {
  primary: fg(palette.primary),
  primaryLight: fg(palette.primaryLight),
  success: fg(palette.success),
  error: fg(palette.error),
  warning: fg(palette.warning),
  muted: fg(palette.muted),
  mutedDark: fg(palette.mutedDark),
  accent: fg(palette.accent),
  white: fg(palette.white),
  info: fg(palette.info),
  queryBg: bg(palette.queryBg),
  border: fg(palette.border),
  dim: (text: string) => chalk.dim(text),
  bold: (text: string) => chalk.bold(text),
};

export const markdownTheme: MarkdownTheme = {
  heading: (text) => theme.bold(theme.primary(text)),
  link: (text) => theme.primaryLight(text),
  linkUrl: (text) => theme.dim(text),
  code: (text) => theme.primaryLight(text),
  codeBlock: (text) => theme.primaryLight(text),
  codeBlockBorder: (text) => theme.mutedDark(text),
  quote: (text) => theme.info(text),
  quoteBorder: (text) => theme.mutedDark(text),
  hr: (text) => theme.mutedDark(text),
  listBullet: (text) => theme.primary(text),
  bold: (text) => theme.bold(text),
  italic: (text) => chalk.italic(text),
  strikethrough: (text) => chalk.strikethrough(text),
  underline: (text) => chalk.underline(text),
};

export const selectListTheme: SelectListTheme = {
  selectedPrefix: (text) => theme.primaryLight(text),
  selectedText: (text) => theme.bold(theme.primaryLight(text)),
  description: (text) => theme.muted(text),
  scrollInfo: (text) => theme.muted(text),
  noMatch: (text) => theme.muted(text),
};

export const editorTheme: EditorTheme = {
  borderColor: (text) => theme.border(text),
  selectList: selectListTheme,
};
