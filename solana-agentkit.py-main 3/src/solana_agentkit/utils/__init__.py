import logging
from .helpers import (
    decode_utf8,
    encode_bs58,
    decode_bs58,
    to_json,
    format_amount,
    parse_amount,
    shorten_key
)
from .keypair import (
    generate_keypair,
    load_keypair,
    save_keypair,
    KeypairManager,
    KeypairDerivation
)
from .transaction import (
    process_transaction,
    TransactionConfig,
    TransactionBundler,
    TransactionInstructionBuilder
)
from .send_tx import (
    get_priority_fees,
    send_tx,
    PriorityFeeInfo
)

__all__ = [
    # Helper functions
    'decode_utf8',
    'encode_bs58',
    'decode_bs58',
    'to_json',
    'format_amount',
    'parse_amount',
    'shorten_key',
    
    # Keypair utilities
    'generate_keypair',
    'load_keypair',
    'save_keypair',
    'KeypairManager',
    'KeypairDerivation',
    
    # Transaction utilities
    'process_transaction',
    'TransactionConfig',
    'TransactionBundler',
    'TransactionInstructionBuilder',
    
    # Transaction sending
    'get_priority_fees',
    'send_tx',
    'PriorityFeeInfo'
]

def setup_logging(level: str = 'INFO') -> None:
    """Setup logging configuration for utilities."""
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )