import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import { theme } from '../theme.js';

export class UserQueryComponent extends Container {
  private readonly body: Text;

  constructor(query: string) {
    super();
    this.addChild(new Spacer(1));
    this.body = new Text('', 0, 0);
    this.addChild(this.body);
    this.setQuery(query);
  }

  setQuery(query: string) {
    this.body.setText(`${theme.queryBg(theme.white(`❯ ${query} `))}`);
  }
}
