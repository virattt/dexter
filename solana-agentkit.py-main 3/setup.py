# setup.py

from setuptools import setup, find_packages
from pathlib import Path

this_directory = Path(__file__).parent
long_description = (this_directory / "README.md").read_text()

setup(
    name="solana_agentkit",
    version="0.1.3",  # Increment this version number
    description="A Python toolkit for building AI agents on Solana",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="Arhan Subaşı",
    author_email="subasiarhan3@gmail.com",
    url="https://github.com/arhansuba/solana-agentkit",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    include_package_data=True,
    python_requires=">=3.8",
    install_requires=[
        "solana>=0.30.0",
        "anchorpy>=0.14.0",
        "base58>=2.1.0",
        "aiohttp>=3.8.0",
        "langchain>=0.0.200",
        "openai>=1.0.0",
        "python-dotenv>=0.19.0",
        "numpy>=1.21.0",
        "Pillow>=9.0.0",
        "requests>=2.26.0",
        "pydantic>=1.8.2",
        "web3>=6.0.0",
        "cryptography>=3.4.0",
        "pytest>=6.2.5",
        "pytest-asyncio>=0.18.0",
        "typing-extensions>=4.0.0",
    ],
    extras_require={
        'dev': [
            'black>=22.0.0',
            'isort>=5.10.0',
            'mypy>=0.950',
            'pylint>=2.12.0',
            'pytest>=6.2.5',
            'pytest-cov>=3.0.0',
            'pytest-asyncio>=0.18.0',
        ],
        'docs': [
            'sphinx>=4.5.0',
            'sphinx-rtd-theme>=1.0.0',
            'sphinx-autodoc-typehints>=1.18.0',
        ],
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Internet :: WWW/HTTP",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
    ],
    entry_points={
        'console_scripts': [
            'solana-agentkit=solana_agentkit.cli:main',
        ],
    },
    project_urls={
        "Bug Tracker": "https://github.com/arhansuba/solana-agentkit/issues",
        "Documentation": "https://solana-agentkit.readthedocs.io/",
        "Source Code": "https://github.com/arhansuba/solana-agentkit",
    },
    keywords=[
        "solana",
        "blockchain",
        "artificial-intelligence",
        "ai-agents",
        "cryptocurrency",
        "web3",
        "defi",
        "nft",
    ],
)