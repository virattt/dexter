# raydium/layouts.py

from construct import (
    BitsInteger,
    BitsSwapped,
    BitStruct,
    Bytes,
    BytesInteger,
    Const,
    Flag,
    Int8ul,
    Int16ul,
    Int32ul,
    Int64ul,
    Padding,
    Struct as cStruct
)

# Account Flags Layout
ACCOUNT_FLAGS_LAYOUT = BitsSwapped(
    BitStruct(
        "initialized" / Flag,
        "market" / Flag,
        "open_orders" / Flag,
        "request_queue" / Flag,
        "event_queue" / Flag,
        "bids" / Flag,
        "asks" / Flag,
        Const(0, BitsInteger(57))
    )
)

# Pool State Layout V4
POOL_STATE_LAYOUT_V4 = cStruct(
    "status" / Int64ul,
    "nonce" / Int64ul,
    "orderNum" / Int64ul,
    "depth" / Int64ul,
    "coinDecimals" / Int64ul,
    "pcDecimals" / Int64ul,
    "state" / Int64ul,
    "resetFlag" / Int64ul,
    "minSize" / Int64ul,
    "volMaxCutRatio" / Int64ul,
    "amountWaveRatio" / Int64ul,
    "coinLotSize" / Int64ul,
    "pcLotSize" / Int64ul,
    "minPriceMultiplier" / Int64ul,
    "maxPriceMultiplier" / Int64ul,
    "systemDecimalsValue" / Int64ul,
    # Fee parameters
    "minSeparateNumerator" / Int64ul,
    "minSeparateDenominator" / Int64ul,
    "tradeFeeNumerator" / Int64ul,
    "tradeFeeDenominator" / Int64ul,
    "pnlNumerator" / Int64ul,
    "pnlDenominator" / Int64ul,
    "swapFeeNumerator" / Int64ul,
    "swapFeeDenominator" / Int64ul,
    # Pool parameters
    "needTakePnlCoin" / Int64ul,
    "needTakePnlPc" / Int64ul,
    "totalPnlPc" / Int64ul,
    "totalPnlCoin" / Int64ul,
    "poolOpenTime" / Int64ul,
    "punishPcAmount" / Int64ul,
    "punishCoinAmount" / Int64ul,
    "orderbookToInitTime" / Int64ul,
    # Swap amounts
    "swapCoinInAmount" / BytesInteger(16, signed=False, swapped=True),
    "swapPcOutAmount" / BytesInteger(16, signed=False, swapped=True),
    "swapCoin2PcFee" / Int64ul,
    "swapPcInAmount" / BytesInteger(16, signed=False, swapped=True),
    "swapCoinOutAmount" / BytesInteger(16, signed=False, swapped=True),
    "swapPc2CoinFee" / Int64ul,
    # Account addresses
    "poolCoinTokenAccount" / Bytes(32),
    "poolPcTokenAccount" / Bytes(32),
    "coinMintAddress" / Bytes(32),
    "pcMintAddress" / Bytes(32),
    "lpMintAddress" / Bytes(32),
    "ammOpenOrders" / Bytes(32),
    "serumMarket" / Bytes(32),
    "serumProgramId" / Bytes(32),
    "ammTargetOrders" / Bytes(32),
    "poolWithdrawQueue" / Bytes(32),
    "poolTempLpTokenAccount" / Bytes(32),
    "ammOwner" / Bytes(32),
    "pnlOwner" / Bytes(32)
)

# Market State Layout V3
MARKET_STATE_LAYOUT_V3 = cStruct(
    Padding(5),
    "account_flags" / ACCOUNT_FLAGS_LAYOUT,
    "own_address" / Bytes(32),
    "vault_signer_nonce" / Int64ul,
    "base_mint" / Bytes(32),
    "quote_mint" / Bytes(32),
    "base_vault" / Bytes(32),
    "base_deposits_total" / Int64ul,
    "base_fees_accrued" / Int64ul,
    "quote_vault" / Bytes(32),
    "quote_deposits_total" / Int64ul,
    "quote_fees_accrued" / Int64ul,
    "quote_dust_threshold" / Int64ul,
    "request_queue" / Bytes(32),
    "event_queue" / Bytes(32),
    "bids" / Bytes(32),
    "asks" / Bytes(32),
    "base_lot_size" / Int64ul,
    "quote_lot_size" / Int64ul,
    "fee_rate_bps" / Int64ul,
    "referrer_rebate_accrued" / Int64ul,
    Padding(7)
)

# Open Orders Layout
OPEN_ORDERS_LAYOUT = cStruct(
    Padding(5),
    "account_flags" / ACCOUNT_FLAGS_LAYOUT,
    "market" / Bytes(32),
    "owner" / Bytes(32),
    "base_token_free" / Int64ul,
    "base_token_total" / Int64ul,
    "quote_token_free" / Int64ul,
    "quote_token_total" / Int64ul,
    "free_slot_bits" / Bytes(16),
    "is_bid_bits" / Bytes(16),
    "orders" / Bytes(16)[128],
    "client_ids" / Int64ul[128],
    "referrer_rebate_accrued" / Int64ul,
    Padding(7)
)

# Instruction Layouts
SWAP_LAYOUT = cStruct(
    "instruction" / Int8ul,
    "amount_in" / Int64ul,
    "min_amount_out" / Int64ul
)

ADD_LIQUIDITY_LAYOUT = cStruct(
    "instruction" / Int8ul,
    "token_a_amount" / Int64ul,
    "token_b_amount" / Int64ul,
    "min_mint_amount" / Int64ul
)

REMOVE_LIQUIDITY_LAYOUT = cStruct(
    "instruction" / Int8ul,
    "amount" / Int64ul,
    "min_token_a_amount" / Int64ul,
    "min_token_b_amount" / Int64ul
)

# Account Layout
TOKEN_ACCOUNT_LAYOUT = cStruct(
    "mint" / Bytes(32),
    "owner" / Bytes(32),
    "amount" / Int64ul,
    "delegate_option" / Int32ul,
    "delegate" / Bytes(32),
    "state" / Int8ul,
    "is_native_option" / Int32ul,
    "is_native" / Int64ul,
    "delegated_amount" / Int64ul,
    "close_authority_option" / Int32ul,
    "close_authority" / Bytes(32)
)

# Pool Config Layout
POOL_CONFIG_LAYOUT = cStruct(
    "version" / Int8ul,
    "bump_seed" / Int8ul,
    "token_a_decimals" / Int8ul,
    "token_b_decimals" / Int8ul,
    "tick_spacing" / Int16ul,
    "fee_rate" / Int32ul,
    "protocol_fee_rate" / Int32ul,
    "fund_fee_rate" / Int32ul
)

# Instruction Type Enum
INSTRUCTION_TYPES = {
    "initialize_pool": 0,
    "swap": 1,
    "add_liquidity": 2,
    "remove_liquidity": 3,
    "close_position": 4,
    "collect_fees": 5,
    "collect_rewards": 6,
    "create_position": 7,
    "increase_liquidity": 8,
    "decrease_liquidity": 9
}

def encode_instruction_data(instruction_type: str, **kwargs) -> bytes:
    """
    Encode instruction data based on instruction type
    
    Args:
        instruction_type: Type of instruction
        kwargs: Instruction parameters
        
    Returns:
        Encoded instruction data
    """
    instruction_code = INSTRUCTION_TYPES[instruction_type]
    
    if instruction_type == "swap":
        return SWAP_LAYOUT.build({
            "instruction": instruction_code,
            "amount_in": kwargs["amount_in"],
            "min_amount_out": kwargs["min_amount_out"]
        })
    
    elif instruction_type == "add_liquidity":
        return ADD_LIQUIDITY_LAYOUT.build({
            "instruction": instruction_code,
            "token_a_amount": kwargs["token_a_amount"],
            "token_b_amount": kwargs["token_b_amount"],
            "min_mint_amount": kwargs["min_mint_amount"]
        })
    
    elif instruction_type == "remove_liquidity":
        return REMOVE_LIQUIDITY_LAYOUT.build({
            "instruction": instruction_code,
            "amount": kwargs["amount"],
            "min_token_a_amount": kwargs["min_token_a_amount"],
            "min_token_b_amount": kwargs["min_token_b_amount"]
        })
    
    raise ValueError(f"Unknown instruction type: {instruction_type}")

def decode_instruction_data(instruction_type: str, data: bytes) -> dict:
    """
    Decode instruction data based on instruction type
    
    Args:
        instruction_type: Type of instruction
        data: Encoded instruction data
        
    Returns:
        Decoded instruction parameters
    """
    if instruction_type == "swap":
        return SWAP_LAYOUT.parse(data)
    elif instruction_type == "add_liquidity":
        return ADD_LIQUIDITY_LAYOUT.parse(data)
    elif instruction_type == "remove_liquidity":
        return REMOVE_LIQUIDITY_LAYOUT.parse(data)
        
    raise ValueError(f"Unknown instruction type: {instruction_type}")