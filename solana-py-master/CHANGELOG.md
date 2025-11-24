# Changelog

## [0.34.0] - 2024-04-17

### Added

- Add block subscribe/unsubscribe websocket methods [(#418)](https://github.com/michaelhly/solana-py/pull/418)
- Add getInflationReward RPC method [(#413)](https://github.com/michaelhly/solana-py/pull/413)


## [0.33.0] - 2024-03-29

### Changed

- Relax httpx dependency [(#408)](https://github.com/michaelhly/solana-py/pull/408)
- Remove experimental and flawed BlockhashCache [(#408)](https://github.com/michaelhly/solana-py/pull/408). This was a footgun because it broke a lot.
- Upgrade to Solders 0.21.0 (fixes aarch64 compatibility issues) [(#402)](https://github.com/michaelhly/solana-py/pull/402)

## [0.32.0] - 2024-02-12

### Changed

- Upgrade to Solders 0.20 [(#394)](https://github.com/michaelhly/solana-py/pull/394)

## [0.31.0] - 2024-01-02

### Added

- Add sync_native instruction [(#376)](https://github.com/michaelhly/solana-py/pull/376)

### Changed

- Update to latest Solders version [(#383)](https://github.com/michaelhly/solana-py/pull/383)
- Increase confirmation timeout to 90 seconds [(#382)](https://github.com/michaelhly/solana-py/pull/382)

## [0.30.2] - 2023-06-02

- Use latest Solders [(#363)](https://github.com/michaelhly/solana-py/pull/363)

## [0.30.1] - 2023-05-14

### Changed

- Use latest Solders [(#359)](https://github.com/michaelhly/solana-py/pull/359)
- Relax websockets to allow 11.x [(#355)](https://github.com/michaelhly/solana-py/pull/355)

## [0.30.0] - 2023-05-05

### Changed

Use latest Solders [(#352)](https://github.com/michaelhly/solana-py/pull/352)

## [0.29.2] - 2023-04-24

### Changed

Relaxed websockets dependency [(#347)](https://github.com/michaelhly/solana-py/pull/347)

## [0.29.1] - 2022-02-02

### Fixed

Fix accidentally ignoring tx_opts in `send_transaction` methods [(#343)](https://github.com/michaelhly/solana-py/pull/343)

## [0.29.0] - 2023-01-13

### Added

- Add VersionedTransaction support to `send_transaction` and `simulate_transaction` methods [(#334)](https://github.com/michaelhly/solana-py/pull/334)
- Support VersionedMessage in `get_fee_for_message` methods [(#337)](https://github.com/michaelhly/solana-py/pull/337)

### Changed

- Remove redundant classes and modules ([#329](https://github.com/michaelhly/solana-py/pull/329), [#335](https://github.com/michaelhly/solana-py/pull/335) and [#338](https://github.com/michaelhly/solana-py/pull/338)):
    - Remove `PublicKey`, in favour of `solders.pubkey.Pubkey`.
    - Remove `AccountMeta` in favour of `solders.instruction.AccountMeta`.
    - Remove `TransactionInstruction` in favour of `solders.instruction.Instruction`.
    - Remove `Keypair` in favour of `solders.keypair.Keypair`. Your code will need to change as follows: 
        - `my_keypair.public_key` -> `my_keypair.pubkey()`
        - `my_keypair.secret_key` -> `bytes(my_keypair)`
        - `my_keypair.seed` -> `my_keypair.secret()`
        - `my_keypair.sign(msg)` -> `my_keypair.sign_message(msg)`
        - `Keypair.from_secret_key(key)` -> `Keypair.from_bytes(key)`
    - Remove `Message` in favour of `solders.message.Message`.
    - Remove `system_program` in favour of `solders.system_program`. Note: where previously a params object like `AssignParams` called a field `program_id`, it now calls it `owner`.
    - Remove `sysvar` in favour of `solders.sysvar`. The constants in `solders.sysvar` have short names, so instead of `solana.sysvar.SYSVAR_RENT_PUBKEY` you'll use `solders.sysvar.RENT`.
    - Remove `solana.blockhash.Blockhash` in favour of `solders.hash.Hash`. Note: `Blockhash(my_str)` -> `Hash.from_str(my_str)`.
    - Remove `solana.transaction.TransactionSignature` newtype. This was unused - solana-py is already using `solders.signature.Signature`.
    - Remove constant `solana.transaction.SIG_LENGTH` in favour of `solders.signature.Signature.LENGTH`.
    - Remove unused `solana.transaction.SigPubkeyPair`.
- Use latest solders [(#334)](https://github.com/michaelhly/solana-py/pull/334)
- Use new `solders.rpc.requests.SendRawTransaction` in `send_raw_transaction` methods [(#332)](https://github.com/michaelhly/solana-py/pull/332)

## [0.28.1] - 2022-12-29

### Fixed

Fix conversion of MemcmpOpts in `get_program_accounts` methods [(#328)](https://github.com/michaelhly/solana-py/pull/328)

## [0.28.0] - 2022-10-31

### Changed

- Use latest `solders`. Note that the parsed fields of jsonParsed responses are now dicts rather than strings. [(#318)](https://github.com/michaelhly/solana-py/pull/318)
- Remove `requests` dependency [(#315)](https://github.com/michaelhly/solana-py/pull/315)

### Fixed

- Fix flakiness in token client transactions [(#314)](https://github.com/michaelhly/solana-py/pull/314)

## [0.27.2] - 2022-10-15

### Changed

- Use latest `solders` [(#312)](https://github.com/michaelhly/solana-py/pull/312)

## [0.27.1] - 2022-10-14

### Fixed

- Fix incorrect `encoding` arg in `_simulate_transaction_body` [(#311)](https://github.com/michaelhly/solana-py/pull/311)

## [0.27.0] - 2022-10-14

### Changed

- Replace SubscriptionError.code with SubscriptionError.type [(#309)](https://github.com/michaelhly/solana-py/pull/309)

### Fixed 

- Fix parsing of RPC error messages [(#309)](https://github.com/michaelhly/solana-py/pull/309)
- Correctly filter by program_id in _get_token_accounts_convert [(#308)](https://github.com/michaelhly/solana-py/pull/308)


## [0.26.0] - 2022-10-13

### Added

- Added batch request methods `(Async)HTTPProvider.make_batch_request(_unparsed)` [(#304)](https://github.com/michaelhly/solana-py/pull/304)
- Added `make_request_unparsed` to `(Async)HTTPProvider` [(#304)](https://github.com/michaelhly/solana-py/pull/304)

### Changed

- Use solders for parsing RPC requests [(#302)](https://github.com/michaelhly/solana-py/pull/302):
    - **Breaking change**: Every RPC method now returns a strongly typed object instead of a dictionary.
        For example, `client.get_balance` returns `GetBalanceResp`.
    - **Breaking change**: RPC methods now raise `RPCException` if the RPC returns an error result.
        Previously only the transaction sending methods did this.
    - **Breaking change**: RPC methods that can return `jsonParsed` data now have their own dedicated Python
        method you should use. For example, instead of `client.get_account_info(..., encoding="jsonParsed")`
        you should do `client.get_account_info_json_parsed(...)`. This is done for the sake of static typing.
    - **Breaking change**: The `get_accounts` method on the SPL Token client has been split into four separate methods:
        `get_accounts_by_delegate`, `get_accounts_by_owner`, `get_accounts_by_delegate_json_parsed`, and `get_accounts_by_owner_json_parsed`.
    - **Breaking change**: `solana.rpc.responses` has been removed and supplanted by `solders.rpc.responses`.
- Remove unused deps: `apischema`, `based58`, `jsonrpcclient`, `jsonrpcserver`.

- Use Solders for building RPC requests:
    - **Breaking change**: Removed deprecated RPC methods.
    - **Breaking change**: Functions that accepted Union[PublicKey, str] now only accept PublicKey.
    - **Breaking change**: RPC functions that accepted a `str` signature param now expect a `solders.signature.Signature`.

### Fixed

- `send_raw_transaction` now defaults to the client's commitment level if `preflight_commitment` is not otherwise specified.

## [0.25.0] - 2022-06-21

### Fixed

- Use latest Solders version to make objects pickleable again [(#252)](https://github.com/michaelhly/solana-py/pull/252).


### Changed

- Updated httpx to fix critical vulnerability [(#248)](https://github.com/michaelhly/solana-py/pull/248).
- Updated pytest, websockets, pytest-docker, pytest-asyncio to latest. [(#254)](https://github.com/michaelhly/solana-py/pull/254).
- Updated apischema to latest. [(#254)](https://github.com/michaelhly/solana-py/pull/254).


### Added

- Added `get_latest_blockhash` RPC Call. [(#254)](https://github.com/michaelhly/solana-py/pull/254).
- Added `get_fee_for_message` RPC Call. [(#254)](https://github.com/michaelhly/solana-py/pull/254).
- Added confirmation strategy which checks if the transaction has exceeded last valid blockheight. [(#254)](https://github.com/michaelhly/solana-py/pull/254).
- Added `asyncio_mode = auto` in pytest.ini. [(#248)](https://github.com/michaelhly/solana-py/pull/254).
- Added an optional `verify_signature` bool when `transaction.serialize()` is called [(#249)](https://github.com/michaelhly/solana-py/pull/249).
- Added Memo program [(#249)](https://github.com/michaelhly/solana-py/pull/249).


## [0.24.0] - 2022-06-04

### Changed

- Use [solders](https://github.com/kevinheavey/solders) under the hood for keypairs and pubkeys [(#237)](https://github.com/michaelhly/solana-py/pull/237).
- Remove deprecated `Account` entirely [(#238)](https://github.com/michaelhly/solana-py/pull/238).
- Use [solders](https://github.com/kevinheavey/solders) under the hood for `Message` [(#239)](https://github.com/michaelhly/solana-py/pull/239).
- Remove unused and very old instruction.py file [(#240)](https://github.com/michaelhly/solana-py/pull/240).
- Default to client's commitment in confirm_transaction, send_transaction and the `Token` client [(#242)](https://github.com/michaelhly/solana-py/pull/242).
- Use [solders](https://github.com/kevinheavey/solders) under the hood for `Transaction` [(#241)](https://github.com/michaelhly/solana-py/pull/241). BREAKING CHANGES:
  - `Transaction.__init__` no longer accepts a `signatures` argument. If you want to construct a transaction with certain signatures, you can still use `Transaction.populate`.
  - `Transaction.add_signer` has been removed (it was removed from web3.js in September 2020).
  - The `signatures` attribute of `Transaction` has been changed to a read-only property.
  - Where previously a "signature" was represented as `bytes`, it is now expected to be a `solders.signature.Signature`.
    This affects the following properties and functions: `Transaction.signature`, `Transacton.signatures`, `Transaction.add_signature`, `Transaction.populate`
  - The `keypairs` in `Transaction.sign_partial` are now only allowed to be `Keypair` objects. Previously `Union[PublicKey, Keypair]` was allowed.
  - The `.signatures` property of an unsigned transaction is now a list of `solders.signature.Signature.default()` instead
    of an empty list.
- Use [solders](https://github.com/kevinheavey/solders) under the hood for system instructions [(#243)](https://github.com/michaelhly/solana-py/pull/243)

### Added

- Expose `client.commmitment` as a property like in web3.js [(#242)](https://github.com/michaelhly/solana-py/pull/242).

## [0.23.3] - 2022-04-29

### Fixed

- Make transaction message compilation consistent with [@solana/web3.js](https://github.com/solana-labs/solana-web3.js/) ([228](https://github.com/michaelhly/solana-py/pull/228))

## [0.23.2] - 2022-04-17

### Changed

- Relax typing-extensions contraint ([#220](https://github.com/michaelhly/solana-py/pull/220))

## [0.23.1] - 2022-03-31

### Fixed

- Fix str seed input for sp.create_account_with_seed ([#206](https://github.com/michaelhly/solana-py/pull/206))

### Changed

- Update `jsonrpcserver` dependency ([#205](https://github.com/michaelhly/solana-py/pull/205))

## [0.23.0] - 2022-03-06

### Added

- Implement `__hash__` for PublicKey ([#202](https://github.com/michaelhly/solana-py/pull/202))

## [0.22.0] - 2022-03-03

### Added

- Add default RPC client commitment to token client ([#187](https://github.com/michaelhly/solana-py/pull/187))
- Add cluster_api_url function ([#193](https://github.com/michaelhly/solana-py/pull/193))
- Add getBlockHeight RPC method ([#200](https://github.com/michaelhly/solana-py/pulls?q=is%3Apr+is%3Aclosed))

### Changed

- Replace base58 library with based58 [#192](https://github.com/michaelhly/solana-py/pull/192)

## [0.21.0] - 2022-01-13

### Fixed

- Make `program_ids` list deterministic in `compile_message` ([#164](https://github.com/michaelhly/solana-py/pull/164))

### Changed

- Throw more specific Exception in API client on failure to retrieve RPC result ([#166](https://github.com/michaelhly/solana-py/pull/166/files))

### Added

- Add max_retries option to sendTransaction and commitment option to get_transaction ([#165](https://github.com/michaelhly/solana-py/pull/165))
- Add a partial support for vote program ([#167](https://github.com/michaelhly/solana-py/pull/167))

## [0.20.0] - 2021-12-30

### Changed

- Make keypair hashable and move setters out of property functions ([#158](https://github.com/michaelhly/solana-py/pull/158))

### Added

- Optional Commitment parameter to `get_signatures_for_address` ([#157](https://github.com/michaelhly/solana-py/pull/157))
- More SYSVAR constants ([#159](https://github.com/michaelhly/solana-py/pull/159))

## [0.19.1] - 2021-12-21

### Added

- Custom solana-py RPC error handling ([#152](https://github.com/michaelhly/solana-py/pull/152))

## [0.19.0] - 2021-12-02

### Added

- Websockets support ([#144](https://github.com/michaelhly/solana-py/pull/144))
- New client functions ([#139](https://github.com/michaelhly/solana-py/pull/139))
- A timeout param for `Client` and `AsyncClient` ([#146](https://github.com/michaelhly/solana-py/pull/146))

## [0.18.3] - 2021-11-20

### Fixed

- Always return the tx signature when sending transaction (the async method was returning signature status if we were confirming the tx)

### Changed

- Raise OnCurveException instead of generic Exception in `create_program_address`
  ([#128](https://github.com/michaelhly/solana-py/pull/128))

### Added

- Add `until` parameter to `get_signatures_for_address` ([#133](https://github.com/michaelhly/solana-py/pull/133))
- This changelog.

## [0.15.0] - 2021-9-26

### Changed

- To reduce RPC calls from fetching recent blockhashes - allow user-supplied blockhash to `.send_transaction` and dependent fns, and introduce an opt-in blockhash cache ([#102](https://github.com/michaelhly/solana-py/pull/102))
- ReadTheDocs theme and doc changes ([#103](https://github.com/michaelhly/solana-py/pull/103))
- Deprecate `Account` and replace with `Keypair` ([#105](https://github.com/michaelhly/solana-py/pull/105))

### Added

- Implement methods for `solana.system_program` similar to [solana-web3](https://github.com/solana-labs/solana-web3.js/blob/44f32d9857e765dd26647ffd33b0ea0927f73b7a/src/system-program.ts#L743-L771): `create_account_with_seed`, `decode_create_account_with_seed` ([#101](https://github.com/michaelhly/solana-py/pull/101))
- Support for [getMultipleAccounts RPC method](https://docs.solana.com/developing/clients/jsonrpc-api#getmultipleaccounts) ([#103](https://github.com/michaelhly/solana-py/pull/103))
- Support for `solana.rpc.api` methods `get_token_largest_accounts`, `get_token_supply` ([#104](https://github.com/michaelhly/solana-py/pull/104))

## [0.12.1] - 2021-8-28

### Fixed

- Issue with importing `Token` from spl.token.client` ([#91](https://github.com/michaelhly/solana-py/pull/91))
- Packaging fixes ([#85](https://github.com/michaelhly/solana-py/pull/85))

### Added

- Missing `spl.token.async_client` methods - `create_multisig`, `get_mint_info`, `get_account_info`, `approve`, `revoke`, `burn`, `close_account`, `freeze_account`, `thaw_account`, `transfer_checked`, `approve_checked`, `mint_to_checked`, `burn_checked`. Missing `spl.token.client` methods - `create_multisig`, `get_mint_info`, `get_account_info`, `approve`, `revoke`, set_authority`, close_account`, `freeze_account`, `thaw_account`, `transfer_checked`, `approve_checked`, `mint_to_checked`, `burn_checked` ([#89](https://github.com/michaelhly/solana-py/pull/89))

## [0.11.1] - 2021-8-4

### Fixed

- Valid instruction can contain no keys ([#70](https://github.com/michaelhly/solana-py/pull/70))

### Changed

- Commitment levels - deprecated `max`, `root`, `singleGossip`, `recent` and added `processed`, `confirmed`, `finalized` ([#82](https://github.com/michaelhly/solana-py/pull/82))

### Added

- Allocate instruction for system program - `solana.system_program.decode_allocate`, `solana.system_program.decode_allocate_with_seed`, `solana.system_program.allocate` ([#79](https://github.com/michaelhly/solana-py/pull/79))
- Async support - `AsyncClient` and `AsyncToken` classes, refactors sync code, httpx dependency ([#83](https://github.com/michaelhly/solana-py/pull/83))

## [0.10.0] - 2021-7-6

### Fixed

- Valid instruction can contain no keys ([#70](https://github.com/michaelhly/solana-py/pull/70))

### Changed

- Pipenv update
- Use new devnet api endpoint, deprecate `solana.rpc.api.getConfirmedSignaturesForAddress2` and use `solana.rpc.api.getSignaturesForAddress` instead ([#77](https://github.com/michaelhly/solana-py/pull/77))

### Added

- `spl.client.token.set_authority` ([#73](https://github.com/michaelhly/solana-py/pull/73/files))
- `spl.client.token.create_wrapped_native_account` ([#74](https://github.com/michaelhly/solana-py/pull/74))

## [0.9.1] - 2021-5-31

### Fixed

- Integration tests

### Added

- `solana.publickey.create_with_seed` ([#69](https://github.com/michaelhly/solana-py/pull/69))

## [0.9.0] - 2021-5-26

### Fixed

- Mismatch in annotation ([#63](https://github.com/michaelhly/solana-py/pull/63))
- unused imports

### Changed

- Use python-pure25519 curve check util instead of crypto_core_ed25519_is_valid_point

### Added ([#66](https://github.com/michaelhly/solana-py/pull/66))

- python-pure25519 curve check util
- `spl.token.client.create_associated_token_account`
- `spl.token.instructions.get_associated_token_address`
- `spl.token.instructions.create_associated_token_account`
- ATA constant `ASSOCIATED_TOKEN_PROGRAM_ID`
