# Azure OpenAI Configuration Guide

This document explains how to configure Azure OpenAI as the default LLM provider for Dexter.

## Overview

Dexter uses **Azure OpenAI with Managed Identity** as the default provider. This means:
- ✅ **Production**: Uses Azure Managed Identity (no API keys needed)
- ✅ **Development**: Uses Azure CLI credentials (requires `az login`)
- ✅ **Configuration**: All settings loaded from environment variables

## Environment Variables

All Azure OpenAI configuration is loaded from environment variables in your `.env` file:

```bash
# Azure OpenAI Endpoint (your Azure resource URL)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/

# Deployment name (as configured in Azure portal)
AZURE_OPENAI_DEPLOYMENT=gpt-5.2-chat

# API Version (use 2024-08-01-preview if experiencing tool argument issues)
AZURE_OPENAI_API_VERSION=2025-01-01-preview

# Azure Cognitive Services scope (usually this default value)
AZURE_OPENAI_SCOPE=https://cognitiveservices.azure.com/.default

# Managed Identity Client ID (for production authentication)
AZURE_OPENAI_MANAGED_IDENTITY_CLIENT_ID=your-managed-identity-client-id
```

## Quick Setup

### 1. Configure Environment Variables

A `.env` file is already provided with the default Azure OpenAI configuration.

**⚠️ Important:** All Azure OpenAI environment variables are **REQUIRED**. The application will throw an error on startup if any are missing.

To customize for your environment:

```bash
# Edit the existing .env file with your Azure OpenAI values
nano .env
```

Update these required variables:

```bash
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=YOUR-DEPLOYMENT-NAME
AZURE_OPENAI_API_VERSION=2025-01-01-preview
AZURE_OPENAI_SCOPE=https://cognitiveservices.azure.com/.default
AZURE_OPENAI_MANAGED_IDENTITY_CLIENT_ID=YOUR-CLIENT-ID
```

**For new setups:** You can also copy from the template:
```bash
cp env.example .env
```

### 2. Authenticate (Development Only)

For local development, login with Azure CLI:

```bash
az login
```

This authenticates you with Azure so the application can obtain tokens on your behalf.

## Finding Your Configuration Values

### Azure OpenAI Endpoint

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Azure OpenAI resource
3. Click on "Keys and Endpoint"
4. Copy the "Endpoint" value (e.g., `https://your-resource.openai.azure.com/`)

### Deployment Name

1. In Azure Portal, go to your Azure OpenAI resource
2. Click on "Model deployments" or "Deployments"
3. Copy the name of your deployment (e.g., `gpt-5.2-chat`, `gpt-4`)

### API Version

- Use `2025-01-01-preview` for latest features
- Use `2024-08-01-preview` if you experience empty tool arguments bug
- Check [Azure OpenAI API versions](https://learn.microsoft.com/en-us/azure/ai-services/openai/reference) for latest

### Managed Identity Client ID

1. In Azure Portal, go to "Managed Identities"
2. Find your user-assigned managed identity
3. Copy the "Client ID" value

## Authentication Flow

### Development Environment
```
Application → Azure CLI Credentials → Azure AD → Azure OpenAI
```

- Uses `AzureCliCredential` from `@azure/identity`
- Requires `az login` to be run first
- Tokens cached for 5 minutes

### Production Environment
```
Application → Managed Identity → Azure AD → Azure OpenAI
```

- Uses `ManagedIdentityCredential` from `@azure/identity`
- No credentials needed in code or environment
- Automatic token refresh

## Switching Providers

To use a different LLM provider instead of Azure OpenAI:

### OpenAI (Official API)
```bash
# Add to .env
OPENAI_API_KEY=sk-...

# Use models with openai: prefix
bun start
# Then select model: openai:gpt-4
```

### Anthropic Claude
```bash
# Add to .env
ANTHROPIC_API_KEY=sk-ant-...

# Use models with claude- prefix (auto-detected)
bun start
# Then select model: claude-sonnet-4-5
```

### Other Providers
See [README.md](README.md) for full list of supported providers.

## Troubleshooting

### "No valid authentication credentials"

**Solution**: Run `az login` in your terminal

### "Token refresh failed"

**Solution**:
1. Check your Managed Identity has correct permissions on Azure OpenAI resource
2. Verify `AZURE_OPENAI_MANAGED_IDENTITY_CLIENT_ID` is correct
3. Ensure resource has "Cognitive Services OpenAI User" role assigned

### "Deployment not found"

**Solution**:
1. Verify `AZURE_OPENAI_DEPLOYMENT` matches exact deployment name in Azure
2. Check deployment is active and not paused
3. Ensure endpoint URL is correct

### "API version not supported"

**Solution**: Try `AZURE_OPENAI_API_VERSION=2024-08-01-preview` or check [latest versions](https://learn.microsoft.com/en-us/azure/ai-services/openai/reference)

### "Empty tool arguments" error

**Solution**: Change to older API version:
```bash
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

## Security Best Practices

1. ✅ **Never commit `.env` files** - they contain sensitive configuration
2. ✅ **Use Managed Identity in production** - avoid storing credentials
3. ✅ **Rotate managed identity** - if credentials are compromised
4. ✅ **Use Azure Key Vault** - for additional security layer
5. ✅ **Limit scope** - grant minimal permissions needed

## Testing

Run the test suite to verify your Azure OpenAI configuration:

```bash
bun test src/agent/agent-azure-openai.test.ts
```

This will test:
- ✅ Authentication with managed identity
- ✅ LLM API calls
- ✅ Token usage tracking
- ✅ Agent functionality
- ✅ Concurrent requests

## Additional Resources

- [Azure OpenAI Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [Azure Managed Identity](https://learn.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/)
- [Azure CLI Authentication](https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli)
- [@azure/identity Package](https://www.npmjs.com/package/@azure/identity)
