# Security Guidelines for Dark Dexter

## 🔒 Critical Security Information

This document outlines security best practices for using Dark Dexter. **Please read carefully before using this software.**

## ⚠️ NEVER Commit These Files

The following files contain sensitive information and should **NEVER** be committed to git:

### Environment Files
- `.env` - Contains API keys and secrets
- `.env.local` - Local environment overrides
- Any `.env.*` files

### Wallet Files
- `wallet.json` - Contains your private key
- `crossmint_wallet.json` - Crossmint wallet configuration
- Any files ending in `*_wallet.json`
- `*.key` files
- `*.pem` files
- Solana keypair files (`id.json`, `keypair.json`)

## 🛡️ Protected by .gitignore

The repository's `.gitignore` file is configured to exclude:

```
# Environment variables
.env
.env.local
.env.*
**/.env
**/.env.local
**/.env.*

# Wallet files - NEVER commit these!
wallet.json
**/wallet.json
**/*wallet.json
crossmint_wallet.json
**/*_wallet.json
*.key
*.pem
**/*.key
**/*.pem

# Solana keypairs
**/.solana/
id.json
keypair.json
```

## 🔑 API Keys and Secrets

### Required API Keys

Dark Dexter requires the following API keys (stored in `.env`):

1. **BIRDEYE_API_KEY** - For Solana token data
2. **HELIUS_API_KEY** - For Solana RPC access
3. **HELIUS_RPC_URL** - Helius RPC endpoint
4. **CROSSMINT_API_KEY** - For Crossmint wallet operations (optional)
5. **OPENAI_API_KEY** - For AI agent functionality (optional)

### How to Set Up Your .env File

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your actual API keys:
   ```
   BIRDEYE_API_KEY=your_actual_birdeye_api_key_here
   HELIUS_API_KEY=your_actual_helius_api_key_here
   HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your_api_key
   ```

3. **NEVER** commit the `.env` file to git

## 💰 Wallet Security

### Wallet Location

Dark Dexter creates and stores wallet files at:
- Main wallet: `~/.dexter/wallet.json`
- Crossmint wallet: `~/.dexter/crossmint_wallet.json`

### Wallet File Security

**⚠️ CRITICAL:** These wallet files contain your **private keys**. Anyone with access to these files can control your funds.

#### Best Practices:

1. **File Permissions**: Ensure wallet files are readable only by you
   ```bash
   chmod 600 ~/.dexter/wallet.json
   chmod 600 ~/.dexter/crossmint_wallet.json
   ```

2. **Backup**: Keep secure backups of your wallet files
   - Store in encrypted storage
   - Use hardware security keys if possible
   - Keep offline backups in secure locations

3. **Never Share**: Do not share your wallet files with anyone
   - Don't email them
   - Don't store in cloud services (Dropbox, Google Drive, etc.)
   - Don't commit to git repositories

4. **Use Test Networks**: For development and testing, use devnet/testnet
   ```bash
   # Use devnet for testing
   HELIUS_RPC_URL=https://api.devnet.helius-rpc.com/?api-key=your_key
   ```

## 🚨 If Your Keys Are Compromised

If you believe your API keys or wallet private keys have been exposed:

### For API Keys:
1. Immediately revoke the compromised keys in your service provider's dashboard
2. Generate new API keys
3. Update your `.env` file with new keys
4. Review any suspicious activity in your service dashboards

### For Wallet Private Keys:
1. **IMMEDIATELY** transfer all assets to a new, secure wallet
2. Create a new wallet with `dark_dexter.py` (it will auto-generate)
3. Never use the compromised wallet again
4. Review all transactions on the compromised wallet for unauthorized activity

## 📝 Development Best Practices

### When Contributing

1. **Never commit secrets**: Always check files before committing
   ```bash
   # Verify no secrets are being committed
   git diff --cached
   ```

2. **Use environment variables**: Store all sensitive data in environment variables
   ```python
   import os
   api_key = os.getenv('API_KEY')  # ✅ Good
   api_key = "sk-1234567890"        # ❌ Bad
   ```

3. **Review .gitignore**: Ensure `.gitignore` is up to date

### Testing

1. Use test/development API keys when possible
2. Use devnet/testnet for all development
3. Never use real funds for testing

## 🔍 Security Checklist

Before committing code:

- [ ] No `.env` files in commit
- [ ] No `wallet.json` files in commit
- [ ] No hardcoded API keys in code
- [ ] No private keys in code
- [ ] All sensitive data uses environment variables
- [ ] `.gitignore` is properly configured

## 📧 Reporting Security Issues

If you discover a security vulnerability in Dark Dexter:

1. **DO NOT** open a public issue
2. Email security details privately to the maintainers
3. Allow reasonable time for the issue to be addressed before public disclosure

## 🔗 Additional Resources

- [Solana Security Best Practices](https://docs.solana.com/developing/programming-model/accounts#security)
- [OWASP API Security](https://owasp.org/www-project-api-security/)
- [Git Security](https://github.com/git/git/security)

## ⚖️ License and Liability

This software is provided "as is" without warranty. Users are responsible for:
- Securing their own API keys and private keys
- Managing their own wallet security
- Understanding the risks of cryptocurrency transactions
- Following all applicable laws and regulations

---

**Remember: Your security is your responsibility. Stay vigilant and follow best practices.**
