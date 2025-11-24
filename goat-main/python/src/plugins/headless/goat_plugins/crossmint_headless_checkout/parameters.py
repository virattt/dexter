from pydantic import BaseModel, Field, validator, root_validator
from typing import List, Optional, Union, Dict, Any
import re


class PhysicalAddress(BaseModel):
    name: str = Field(description="Full name of the recipient")
    line1: str = Field(description="Street address, P.O. box, company name, c/o")
    line2: Optional[str] = Field(None, description="Apartment, suite, unit, building, floor, etc.")
    city: str = Field(description="City, district, suburb, town, or village")
    state: Optional[str] = Field(None, description="State/Province/Region - optional")
    postalCode: str = Field(description="ZIP or postal code")
    country: str = Field(description="Two-letter country code (ISO 3166-1 alpha-2). Currently only US is supported.")

    @validator('name')
    def validate_name(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError("Name is required for physical address")
        return v

    @validator('line1')
    def validate_line1(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError("Line 1 is required for physical address")
        return v

    @validator('city')
    def validate_city(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError("City is required for physical address")
        return v

    @validator('postalCode')
    def validate_postal_code(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError("Postal/ZIP code is required for physical address")
        return v

    @validator('country')
    def validate_country(cls, v):
        if not v:
            raise ValueError("Country is required for physical address")
        
        # Convert to uppercase
        v = v.upper()
        
        # Validate length (must be exactly 2 characters for ISO 3166-1 alpha-2)
        if len(v) < 2:
            raise ValueError("Country must be a 2-letter ISO code for physical address")
        if len(v) > 2:
            raise ValueError("Country must be a 2-letter ISO code for physical address")
        
        # Currently only US is supported
        if v != "US":
            raise ValueError("Only 'US' country code is supported at this time")
        
        return v
    
    @root_validator(skip_on_failure=True)
    def validate_state_for_us(cls, values):
        country = values.get('country')
        state = values.get('state')
        
        # State is required for US addresses
        if country == "US" and not state:
            raise ValueError("State is required for US physical address")
        
        return values


class Recipient(BaseModel):
    email: str = Field(description="Email address for the recipient")
    physicalAddress: Optional[PhysicalAddress] = Field(
        None, 
        description="Physical shipping address for the recipient. Required when purchasing physical products."
    )

    @validator('email')
    def validate_email(cls, v):
        if not v:
            raise ValueError("Email is required")
        
        # Basic email validation regex that matches common email formats
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, v):
            raise ValueError("value is not a valid email address")
        
        return v


class Payment(BaseModel):
    method: str = Field(
        description="The blockchain network to use for the transaction (e.g., 'ethereum', 'ethereum-sepolia', 'base', 'base-sepolia', 'polygon', 'polygon-amoy', 'solana')"
    )
    currency: str = Field(
        description="The currency to use for payment (e.g., 'usdc' or 'eth' or 'sol')"
    )
    payerAddress: str = Field(
        description="The address that will pay for the transaction"
    )
    receiptEmail: Optional[str] = Field(
        None,
        description="Optional email to send payment receipt to"
    )

    @validator('method')
    def validate_method(cls, v):
        allowed_methods = ["ethereum", "ethereum-sepolia", "base", "base-sepolia", "polygon", "polygon-amoy", "solana"]
        if v not in allowed_methods:
            raise ValueError(f"Method must be one of: {', '.join(allowed_methods)}")
        return v

    @validator('currency')
    def validate_currency(cls, v):
        allowed_currencies = ["usdc", "eth", "sol"]
        if v not in allowed_currencies:
            raise ValueError(f"Currency must be one of: {', '.join(allowed_currencies)}")
        return v


class CollectionLineItem(BaseModel):
    collectionLocator: str = Field(
        description="The collection locator. Ex: 'crossmint:<crossmint_collection_id>', '<chain>:<contract_address>'"
    )
    callData: Optional[Dict[str, Any]] = None


class ProductLineItem(BaseModel):
    productLocator: str = Field(
        description="The product locator. Ex: 'amazon:<amazon_product_id>', 'amazon:<asin>'"
    )
    callData: Optional[Dict[str, Any]] = None


class BuyTokenParameters(BaseModel):
    recipient: Recipient = Field(
        description="Where the tokens will be sent to - either a wallet address or email, if email is provided a Crossmint wallet will be created and associated with the email"
    )
    locale: str = Field(
        default="en-US",
        description="The locale for the order (e.g., 'en-US')"
    )
    payment: Payment = Field(
        description="Payment configuration - the desired blockchain, currency and address of the payer - optional receipt email, if an email recipient was not provided"
    )
    lineItems: List[Union[CollectionLineItem, ProductLineItem]] = Field(
        description="Array of items to purchase"
    )


class GetOrderParameters(BaseModel):
    order_id: str = Field(
        description="The unique identifier of the order to retrieve"
    )
