import { Container, Spacer, Text, type Component } from '@mariozechner/pi-tui';
import packageJson from '../../package.json';
import { getModelDisplayName } from '../utils/model.js';
import { theme } from '../theme.js';

const INTRO_WIDTH = 50;

export class IntroComponent extends Container {
  private readonly modelText: Text;
  private readonly fullChildren: Component[] = [];
  private isCompact = false;

  constructor(model: string) {
    super();

    const welcomeText = 'Welcome to Dexter';
    const versionText = ` v${packageJson.version}`;
    const fullText = welcomeText + versionText;
    const padding = Math.floor((INTRO_WIDTH - fullText.length - 2) / 2);
    const trailing = INTRO_WIDTH - fullText.length - padding - 2;

    const spacerTop = new Spacer(1);
    const topBorder = new Text(theme.primary('═'.repeat(INTRO_WIDTH)), 0, 0);
    const titleLine = new Text(
      theme.primary(
        `║${' '.repeat(padding)}${theme.bold(welcomeText)}${theme.muted(versionText)}${' '.repeat(
          trailing,
        )}║`,
      ),
      0,
      0,
    );
    const bottomBorder = new Text(theme.primary('═'.repeat(INTRO_WIDTH)), 0, 0);
    const spacerMid = new Spacer(1);
    const asciiArt = new Text(
      theme.bold(
        theme.primary(
          `
██████╗ ███████╗██╗  ██╗████████╗███████╗██████╗ 
██╔══██╗██╔════╝╚██╗██╔╝╚══██╔══╝██╔════╝██╔══██╗
██║  ██║█████╗   ╚███╔╝    ██║   █████╗  ██████╔╝
██║  ██║██╔══╝   ██╔██╗    ██║   ██╔══╝  ██╔══██╗
██████╔╝███████╗██╔╝ ██╗   ██║   ███████╗██║  ██║
╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝`,
        ),
      ),
      0,
      0,
    );
    const spacerBottom = new Spacer(1);
    const description = new Text('Your AI assistant for deep financial research.', 0, 0);
    this.modelText = new Text('', 0, 0);

    this.fullChildren = [
      spacerTop,
      topBorder,
      titleLine,
      bottomBorder,
      spacerMid,
      asciiArt,
      spacerBottom,
      description,
      this.modelText,
    ];

    for (const child of this.fullChildren) {
      this.addChild(child);
    }

    this.setModel(model);
  }

  /** Switch between full (welcome) and compact (single-line) display modes. */
  setCompact(compact: boolean) {
    if (this.isCompact === compact) return;
    this.isCompact = compact;
    this.clear();
    if (compact) {
      this.addChild(this.modelText);
    } else {
      for (const child of this.fullChildren) {
        this.addChild(child);
      }
    }
  }

  setModel(model: string) {
    const modelLabel = getModelDisplayName(model);
    if (this.isCompact) {
      this.modelText.setText(
        `${theme.muted('⬡ Dexter · ')}${theme.primary(modelLabel)}${theme.muted(' · /model to change')}`,
      );
    } else {
      this.modelText.setText(
        `${theme.muted('Model: ')}${theme.primary(modelLabel)}${theme.muted(
          '. Type /model to change.',
        )}`,
      );
    }
  }
}
