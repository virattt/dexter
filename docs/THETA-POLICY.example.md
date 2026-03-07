# THETA POLICY

Allowed underlyings: SPX, SPY, QQQ, IWM
No-call list: NVDA, TSM, ASML
Short delta range: 0.10-0.20
DTE range: 0-45
Max risk per trade: 3%
Max buying power usage: 50%
Exclude earnings days: 2

## Notes

- `Allowed underlyings` controls what Dexter scans by default in `tastytrade_theta_scan`.
- `No-call list` blocks covered-call suggestions on core long-term holdings.
- `Short delta range` and `DTE range` act as defaults; you can still override them in a specific scan.
- `Max risk per trade` and `Max buying power usage` are safety caps for preview and scan ranking.
- `Exclude earnings days` tells Dexter to avoid pre/post-earnings windows when you ask for safer short-premium setups.

Copy this file to `~/.dexter/THETA-POLICY.md` and edit it to match your rules.
