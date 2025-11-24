"""Test security txt."""

import pytest

from solana.utils.security_txt import NoSecurityTxtFoundError, parse_security_txt


def test_parse_security_text():
    """Test parsing security txt bytes."""
    data = b"=======BEGIN SECURITY.TXT V1=======\x00name\x00Example\x00project_url\x00http://example.com\x00contacts\x00email:example@example.com,link:https://example.com/security,discord:example#1234\x00policy\x00https://github.com/solana-labs/solana/blob/master/SECURITY.md\x00preferred_languages\x00en,de\x00source_code\x00https://github.com/example/example\x00encryption\x00\n-----BEGIN PGP PUBLIC KEY BLOCK-----\nComment: Alice's OpenPGP certificate\nComment: https://www.ietf.org/id/draft-bre-openpgp-samples-01.html\n\nmDMEXEcE6RYJKwYBBAHaRw8BAQdArjWwk3FAqyiFbFBKT4TzXcVBqPTB3gmzlC/U\nb7O1u120JkFsaWNlIExvdmVsYWNlIDxhbGljZUBvcGVucGdwLmV4YW1wbGU+iJAE\nExYIADgCGwMFCwkIBwIGFQoJCAsCBBYCAwECHgECF4AWIQTrhbtfozp14V6UTmPy\nMVUMT0fjjgUCXaWfOgAKCRDyMVUMT0fjjukrAPoDnHBSogOmsHOsd9qGsiZpgRnO\ndypvbm+QtXZqth9rvwD9HcDC0tC+PHAsO7OTh1S1TC9RiJsvawAfCPaQZoed8gK4\nOARcRwTpEgorBgEEAZdVAQUBAQdAQv8GIa2rSTzgqbXCpDDYMiKRVitCsy203x3s\nE9+eviIDAQgHiHgEGBYIACAWIQTrhbtfozp14V6UTmPyMVUMT0fjjgUCXEcE6QIb\nDAAKCRDyMVUMT0fjjlnQAQDFHUs6TIcxrNTtEZFjUFm1M0PJ1Dng/cDW4xN80fsn\n0QEA22Kr7VkCjeAEC08VSTeV+QFsmz55/lntWkwYWhmvOgE=\n=iIGO\n-----END PGP PUBLIC KEY BLOCK-----\n\x00auditors\x00Neodyme\x00acknowledgements\x00\nThe following hackers could've stolen all our money but didn't:\n- Neodyme\n\x00=======END SECURITY.TXT V1=======\x00"  # noqa: E501  pylint: disable=line-too-long
    security_text = parse_security_txt(data)
    assert security_text.name
    assert security_text.project_url
    assert security_text.contacts
    assert security_text.policy


def test_parse_invalid_security_text():
    """Test parsing security txt with invalid bytes."""
    invalid_data = b"test"
    with pytest.raises(NoSecurityTxtFoundError):
        parse_security_txt(invalid_data)


def test_parse_wrong_data_type():
    """Test parsing security txt string instead of bytes."""
    wrong_type = "test"
    with pytest.raises(TypeError):
        parse_security_txt(wrong_type)


def test_parse_missing_required_fields():
    """Test parsing security txt with missing required data."""
    data = b"=======BEGIN SECURITY.TXT V1=======\x00project_url\x00http://example.com\x00contacts\x00email:example@example.com,link:https://example.com/security,discord:example#1234\x00policy\x00https://github.com/solana-labs/solana/blob/master/SECURITY.md\x00preferred_languages\x00en,de\x00source_code\x00https://github.com/example/example\x00encryption\x00\n-----BEGIN PGP PUBLIC KEY BLOCK-----\nComment: Alice's OpenPGP certificate\nComment: https://www.ietf.org/id/draft-bre-openpgp-samples-01.html\n\nmDMEXEcE6RYJKwYBBAHaRw8BAQdArjWwk3FAqyiFbFBKT4TzXcVBqPTB3gmzlC/U\nb7O1u120JkFsaWNlIExvdmVsYWNlIDxhbGljZUBvcGVucGdwLmV4YW1wbGU+iJAE\nExYIADgCGwMFCwkIBwIGFQoJCAsCBBYCAwECHgECF4AWIQTrhbtfozp14V6UTmPy\nMVUMT0fjjgUCXaWfOgAKCRDyMVUMT0fjjukrAPoDnHBSogOmsHOsd9qGsiZpgRnO\ndypvbm+QtXZqth9rvwD9HcDC0tC+PHAsO7OTh1S1TC9RiJsvawAfCPaQZoed8gK4\nOARcRwTpEgorBgEEAZdVAQUBAQdAQv8GIa2rSTzgqbXCpDDYMiKRVitCsy203x3s\nE9+eviIDAQgHiHgEGBYIACAWIQTrhbtfozp14V6UTmPyMVUMT0fjjgUCXEcE6QIb\nDAAKCRDyMVUMT0fjjlnQAQDFHUs6TIcxrNTtEZFjUFm1M0PJ1Dng/cDW4xN80fsn\n0QEA22Kr7VkCjeAEC08VSTeV+QFsmz55/lntWkwYWhmvOgE=\n=iIGO\n-----END PGP PUBLIC KEY BLOCK-----\n\x00auditors\x00Neodyme\x00acknowledgements\x00\nThe following hackers could've stolen all our money but didn't:\n- Neodyme\n\x00=======END SECURITY.TXT V1=======\x00"  # noqa: E501  pylint: disable=line-too-long
    with pytest.raises(TypeError):
        parse_security_txt(data)
