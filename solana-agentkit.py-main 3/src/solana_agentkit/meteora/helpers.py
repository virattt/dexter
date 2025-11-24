# utils/helpers.py

class BN:
    """
    Enhanced Big Number implementation for DeFi calculations
    """
    
    def __init__(self, value: int):
        """Initialize BN with an integer value"""
        self.value = int(value)
    
    def to_bytes(self, length: int, byteorder: str, signed: bool = False) -> bytes:
        """Convert to bytes representation"""
        return self.value.to_bytes(length, byteorder, signed=signed)
    
    # Basic arithmetic operations
    def __add__(self, other):
        return BN(self.value + int(other))
    
    def __sub__(self, other):
        return BN(self.value - int(other))
    
    def __mul__(self, other):
        return BN(self.value * int(other))
    
    def __floordiv__(self, other):
        return BN(self.value // int(other))
    
    def __mod__(self, other):
        return BN(self.value % int(other))
    
    def __neg__(self):
        return BN(-self.value)
    
    # Extended arithmetic operations
    def __pow__(self, other):
        """Power operation with optional modulo"""
        if isinstance(other, BN):
            other = other.value
        return BN(pow(self.value, int(other)))
    
    def sqrt(self):
        """Calculate square root"""
        if self.value < 0:
            raise ValueError("Square root of negative number")
        return BN(int(self.value ** 0.5))
    
    def pow(self, exponent: 'BN', modulus: 'BN' = None):
        """Power with optional modulus"""
        if modulus:
            return BN(pow(self.value, int(exponent), int(modulus)))
        return self.__pow__(exponent)
    
    # Comparison operations
    def __eq__(self, other):
        return self.value == int(other)
    
    def __lt__(self, other):
        return self.value < int(other)
    
    def __le__(self, other):
        return self.value <= int(other)
    
    def __gt__(self, other):
        return self.value > int(other)
    
    def __ge__(self, other):
        return self.value >= int(other)
    
    # Bitwise operations
    def __and__(self, other):
        return BN(self.value & int(other))
    
    def __or__(self, other):
        return BN(self.value | int(other))
    
    def __xor__(self, other):
        return BN(self.value ^ int(other))
    
    def __lshift__(self, other):
        return BN(self.value << int(other))
    
    def __rshift__(self, other):
        return BN(self.value >> int(other))
    
    # DeFi specific operations
    def to_fixed_point(self, decimals: int = 6):
        """Convert to fixed-point representation"""
        return BN(self.value * 10 ** decimals)
    
    def from_fixed_point(self, decimals: int = 6):
        """Convert from fixed-point representation"""
        return BN(self.value // 10 ** decimals)
    
    def calculate_percentage(self, percentage: int):
        """Calculate percentage of the number"""
        return BN((self.value * percentage) // 100)
    
    def calculate_basis_points(self, bps: int):
        """Calculate basis points of the number"""
        return BN((self.value * bps) // 10000)
    
    # Utility methods
    def abs(self):
        """Get absolute value"""
        return BN(abs(self.value))
    
    def is_neg(self):
        """Check if number is negative"""
        return self.value < 0
    
    def is_zero(self):
        """Check if number is zero"""
        return self.value == 0
    
    def is_positive(self):
        """Check if number is positive"""
        return self.value > 0
    
    def min(self, other):
        """Return minimum of two numbers"""
        return BN(min(self.value, int(other)))
    
    def max(self, other):
        """Return maximum of two numbers"""
        return BN(max(self.value, int(other)))
    
    def clamp(self, minimum: 'BN', maximum: 'BN'):
        """Clamp value between minimum and maximum"""
        return self.max(minimum).min(maximum)
    
    def to_decimal_str(self, decimals: int = 6):
        """Convert to decimal string with given precision"""
        if decimals == 0:
            return str(self.value)
        
        value_str = str(self.value).zfill(decimals + 1)
        decimal_point = len(value_str) - decimals
        
        return f"{value_str[:decimal_point]}.{value_str[decimal_point:]}"
    
    # Type conversion and representation
    def __int__(self):
        return self.value
    
    def __repr__(self):
        return f"BN({self.value})"
    
    def __str__(self):
        return str(self.value)
    
    @classmethod
    def from_string(cls, value: str, base: int = 10):
        """Create BN from string with optional base"""
        return cls(int(value, base))
    
    @classmethod
    def from_bytes(cls, bytes_: bytes, byteorder: str = 'big', signed: bool = False):
        """Create BN from bytes"""
        return cls(int.from_bytes(bytes_, byteorder, signed=signed))

    # Financial calculations
    def calculate_slippage(self, percentage: float):
        """Calculate amount with slippage"""
        slippage = int(percentage * 100)  # Convert to basis points
        return {
            "min": self - self.calculate_basis_points(slippage),
            "max": self + self.calculate_basis_points(slippage)
        }

    def calculate_price_impact(self, original_price: 'BN', new_price: 'BN'):
        """Calculate price impact percentage"""
        if original_price.is_zero():
            raise ValueError("Original price cannot be zero")
        
        price_diff = new_price - original_price
        return BN((price_diff.value * 10000) // original_price.value)  # In basis points