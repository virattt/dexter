# Solana Program Library (SPL)

The Solana Program Library (SPL) is a collection of on-chain programs targeting the
[Sealevel parallel runtime](https://medium.com/solana-labs/sealevel-parallel-processing-thousands-of-smart-contracts-d814b378192).
These programs are tested against Solana's implementation of Sealevel, solana-runtime, and deployed to its mainnet.

!!! note

    The Python SPL library is separate from the main Python Solana library,
    so you import it with `import spl` instead of `import solana`.

    You don't install it separately though: it gets installed
    when you run `pip install solana`.
