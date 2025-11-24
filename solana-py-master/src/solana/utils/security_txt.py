"""Utils for security.txt."""

from dataclasses import dataclass, fields
from typing import Any, List, Optional

HEADER = "=======BEGIN SECURITY.TXT V1=======\0"
"""Header of the security.txt."""
FOOTER = "=======END SECURITY.TXT V1=======\0"
"""Footer of the security.txt."""


@dataclass
class SecurityTxt:
    """Security txt data."""

    # pylint: disable=too-many-instance-attributes
    name: str
    project_url: str
    contacts: str
    policy: str
    preferred_languages: Optional[str] = None
    source_code: Optional[str] = None
    encryption: Optional[str] = None
    auditors: Optional[str] = None
    acknowledgements: Optional[str] = None
    expiry: Optional[str] = None


class NoSecurityTxtFoundError(Exception):
    """Raise when security text is not found."""


def parse_security_txt(data: bytes) -> SecurityTxt:
    """Parse and extract security.txt section from the data section of the compiled program.

    Args:
        data: Program data in bytes from the ProgramAccount.

    Returns:
        The Security Txt.
    """
    if not isinstance(data, bytes):
        raise TypeError(f"data provided in parse(data) must be bytes, found: {type(data)}")

    s_idx = data.find(bytes(HEADER, "utf-8"))
    e_idx = data.find(bytes(FOOTER, "utf-8"))

    if s_idx == -1:
        raise NoSecurityTxtFoundError("Program doesn't have security.txt section")

    content_arr = data[s_idx + len(HEADER) : e_idx]
    content_da: List[Any] = [[]]

    for char in content_arr:
        if char == 0:
            content_da.append([])
        else:
            content_da[len(content_da) - 1].append(chr(char))

    content_da.pop()

    content_dict = {}

    for idx, content in enumerate(content_da):
        content_da[idx] = "".join(content)

    for iidx, idata in enumerate(content_da):
        if any(idata == x.name for x in fields(SecurityTxt)):
            next_key = iidx + 1
            content_dict.update({str(idata): content_da[next_key]})

    try:
        security_txt = SecurityTxt(**content_dict)
    except TypeError as err:
        raise err
    return security_txt
