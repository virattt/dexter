/**
 * Unit tests for InputHistoryController.
 *
 * The controller wraps LongTermChatHistory. We replace the private `store`
 * field with a fake after construction — no module mocking required.
 */
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { InputHistoryController } from './input-history.js';

// ---------------------------------------------------------------------------
// Fake store factory — mimics the LongTermChatHistory API
// ---------------------------------------------------------------------------

function makeFakeStore(messages: string[] = ['alpha', 'beta', 'gamma']) {
  let _messages = [...messages];
  return {
    load: mock(async () => {}),
    getMessageStrings: mock(() => [..._messages]),
    addUserMessage: mock(async (msg: string) => {
      _messages = [msg, ..._messages];
    }),
    updateAgentResponse: mock(async (_response: string) => {}),
    // Expose for test inspection
    _getMessages: () => _messages,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeController(onChange?: () => void) {
  const ctrl = new InputHistoryController(onChange);
  const store = makeFakeStore();
  // Inject fake store — avoids touching real files
  (ctrl as unknown as { store: typeof store }).store = store;
  return { ctrl, store };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InputHistoryController — init', () => {
  it('loads messages from store on init', async () => {
    const { ctrl, store } = makeController();
    await ctrl.init();

    expect(store.load).toHaveBeenCalledTimes(1);
    expect(store.getMessageStrings).toHaveBeenCalledTimes(1);
    expect(ctrl.getMessages()).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('calls onChange after init', async () => {
    const onChange = mock(() => {});
    const ctrl = new InputHistoryController(onChange);
    const store = makeFakeStore();
    (ctrl as unknown as { store: typeof store }).store = store;

    await ctrl.init();
    expect(onChange).toHaveBeenCalled();
  });
});

describe('InputHistoryController — setOnChange', () => {
  it('registers a new onChange listener', async () => {
    const { ctrl } = makeController();
    await ctrl.init();

    const newListener = mock(() => {});
    ctrl.setOnChange(newListener);

    ctrl.resetNavigation(); // triggers emitChange
    expect(newListener).toHaveBeenCalled();
  });

  it('removes listener when called with undefined', async () => {
    const listener = mock(() => {});
    const { ctrl } = makeController(listener);
    await ctrl.init();

    listener.mockClear();
    ctrl.setOnChange(undefined);
    ctrl.resetNavigation();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('InputHistoryController — historyValue', () => {
  it('returns null when navigation index is -1 (initial)', async () => {
    const { ctrl } = makeController();
    await ctrl.init();
    expect(ctrl.historyValue).toBeNull();
  });

  it('returns the most recent message after navigateUp', async () => {
    const { ctrl } = makeController();
    await ctrl.init();
    ctrl.navigateUp();
    expect(ctrl.historyValue).toBe('alpha');
  });

  it('returns second message after two navigateUp calls', async () => {
    const { ctrl } = makeController();
    await ctrl.init();
    ctrl.navigateUp();
    ctrl.navigateUp();
    expect(ctrl.historyValue).toBe('beta');
  });
});

describe('InputHistoryController — getMessages', () => {
  it('returns a copy of the messages array', async () => {
    const { ctrl } = makeController();
    await ctrl.init();
    const msgs = ctrl.getMessages();
    expect(msgs).toEqual(['alpha', 'beta', 'gamma']);
    // Mutation should not affect internal array
    msgs.push('injected');
    expect(ctrl.getMessages()).toHaveLength(3);
  });
});

describe('InputHistoryController — navigateUp', () => {
  it('does nothing when messages are empty', async () => {
    const ctrl = new InputHistoryController();
    const store = makeFakeStore([]);
    (ctrl as unknown as { store: typeof store }).store = store;
    await ctrl.init();

    ctrl.navigateUp();
    expect(ctrl.historyValue).toBeNull();
  });

  it('clamps at the oldest message (does not go beyond last index)', async () => {
    const { ctrl } = makeController();
    await ctrl.init();

    ctrl.navigateUp(); // index 0 = 'alpha'
    ctrl.navigateUp(); // index 1 = 'beta'
    ctrl.navigateUp(); // index 2 = 'gamma'
    ctrl.navigateUp(); // should stay at 2
    ctrl.navigateUp(); // should stay at 2

    expect(ctrl.historyValue).toBe('gamma');
  });
});

describe('InputHistoryController — navigateDown', () => {
  it('does nothing when index is -1', async () => {
    const { ctrl } = makeController();
    await ctrl.init();

    ctrl.navigateDown(); // already at -1
    expect(ctrl.historyValue).toBeNull();
  });

  it('returns to null when navigating down from index 0', async () => {
    const { ctrl } = makeController();
    await ctrl.init();

    ctrl.navigateUp();   // index 0
    ctrl.navigateDown(); // back to -1
    expect(ctrl.historyValue).toBeNull();
  });

  it('decrements index by one when above 0', async () => {
    const { ctrl } = makeController();
    await ctrl.init();

    ctrl.navigateUp(); // 0 → alpha
    ctrl.navigateUp(); // 1 → beta
    ctrl.navigateDown(); // back to 0 → alpha
    expect(ctrl.historyValue).toBe('alpha');
  });
});

describe('InputHistoryController — resetNavigation', () => {
  it('resets index to -1 and emits change', async () => {
    const onChange = mock(() => {});
    const { ctrl } = makeController(onChange);
    await ctrl.init();

    ctrl.navigateUp();
    ctrl.navigateUp();
    expect(ctrl.historyValue).toBe('beta');

    onChange.mockClear();
    ctrl.resetNavigation();
    expect(ctrl.historyValue).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('InputHistoryController — saveMessage', () => {
  it('adds message to store and updates local messages', async () => {
    const { ctrl, store } = makeController();
    await ctrl.init();

    await ctrl.saveMessage('new message');

    expect(store.addUserMessage).toHaveBeenCalledWith('new message');
    // getMessageStrings is called after addUserMessage to refresh
    expect(ctrl.getMessages()[0]).toBe('new message');
  });

  it('emits change after saving message', async () => {
    const onChange = mock(() => {});
    const { ctrl } = makeController(onChange);
    await ctrl.init();

    onChange.mockClear();
    await ctrl.saveMessage('hello');
    expect(onChange).toHaveBeenCalled();
  });
});

describe('InputHistoryController — updateAgentResponse', () => {
  it('delegates to store.updateAgentResponse', async () => {
    const { ctrl, store } = makeController();
    await ctrl.init();

    await ctrl.updateAgentResponse('Agent replied: hello');
    expect(store.updateAgentResponse).toHaveBeenCalledWith('Agent replied: hello');
  });
});
