# OAuth Authentication Setup Guide

This guide explains how to set up OAuth authentication for the Lodgify MCP server using various providers.

## Table of Contents

- [Overview](#overview)
- [Authentication Modes](#authentication-modes)
- [Bearer Token Authentication](#bearer-token-authentication)
- [OAuth 2.1 Setup](#oauth-21-setup)
  - [Google OAuth](#google-oauth)
  - [GitHub OAuth](#github-oauth)
  - [Auth0](#auth0)
  - [Keycloak](#keycloak)
- [Docker Deployment](#docker-deployment)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The Lodgify MCP server supports four authentication modes:

1. **Bearer Token** - Simple token-based authentication (default, backward compatible)
2. **OAuth 2.1** - Modern OAuth authentication with PKCE
3. **Dual Mode** - Support both authentication methods simultaneously
4. **None (No Auth)** - Disable authentication entirely (development only)

## Authentication Modes

### Configuring Authentication Mode

Set the `AUTH_MODE` environment variable:

```bash
AUTH_MODE=bearer  # Bearer token only (default)
AUTH_MODE=oauth   # OAuth only
AUTH_MODE=dual    # Both methods supported
AUTH_MODE=none    # No authentication (development only)
```

## Bearer Token Authentication

The simplest authentication method, ideal for development and single-user deployments.

### Setup

1. Generate a secure token (minimum 32 characters):

```bash
openssl rand -hex 32
```

2. Set the environment variable:

```bash
# Using new variable name
AUTH_BEARER_TOKEN=your-generated-token-here

# Or legacy variable (backward compatible)
MCP_TOKEN=your-generated-token-here
```

3. Use the token in API requests:

```bash
curl -H "Authorization: Bearer your-generated-token-here" \
  http://localhost:3000/mcp
```

## OAuth 2.1 Setup

OAuth provides secure, delegated authentication with support for multiple users and refresh tokens.

### Common Configuration

All OAuth providers require these base settings:

```bash
AUTH_MODE=oauth  # or dual
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
SESSION_SECRET=your-session-secret-minimum-32-chars
BASE_URL=http://localhost:3000  # Your server URL
```

### Google OAuth

Google provides free OAuth for all Google accounts.

#### Setup Steps

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google+ API

2. **Configure OAuth Consent Screen**
   - Navigate to APIs & Services > OAuth consent screen
   - Choose "External" for public access
   - Fill in application details
   - Add scopes: `openid`, `profile`, `email`

3. **Create OAuth Credentials**
   - Go to APIs & Services > Credentials
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Add authorized redirect URI: `http://localhost:3000/auth/callback`
   - Copy Client ID and Client Secret

4. **Configure Environment**

```bash
AUTH_MODE=oauth
OAUTH_PROVIDER=google
OAUTH_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
OAUTH_CLIENT_SECRET=your-google-client-secret
OAUTH_SCOPES="openid profile email"
SESSION_SECRET=your-session-secret-minimum-32-chars
BASE_URL=http://localhost:3000
```

5. **Test Authentication**
   - Navigate to `http://localhost:3000/auth/authorize`
   - Complete Google sign-in
   - Receive access token

### GitHub OAuth

GitHub OAuth is free for all GitHub users.

#### Setup Steps

1. **Create GitHub OAuth App**
   - Go to [GitHub Settings > Developer settings](https://github.com/settings/developers)
   - Click "New OAuth App"
   - Fill in details:
     - Application name: Your app name
     - Homepage URL: `http://localhost:3000`
     - Authorization callback URL: `http://localhost:3000/auth/callback`
   - Copy Client ID and Client Secret

2. **Configure Environment**

```bash
AUTH_MODE=oauth
OAUTH_PROVIDER=github
OAUTH_CLIENT_ID=your-github-client-id
OAUTH_CLIENT_SECRET=your-github-client-secret
OAUTH_SCOPES="read:user user:email"
SESSION_SECRET=your-session-secret-minimum-32-chars
BASE_URL=http://localhost:3000
```

3. **Note**: GitHub doesn't support PKCE yet, but our implementation includes it for future compatibility.

### Auth0

Auth0 provides a free tier with 7,000 active users.

#### Setup Steps

1. **Create Auth0 Account**
   - Sign up at [auth0.com](https://auth0.com/)
   - Create a new Application
   - Choose "Regular Web Application"

2. **Configure Application**
   - Note your Domain, Client ID, and Client Secret
   - Add Allowed Callback URLs: `http://localhost:3000/auth/callback`
   - Add Allowed Logout URLs: `http://localhost:3000`
   - Enable desired connections (Google, GitHub, etc.)

3. **Configure Environment**

```bash
AUTH_MODE=oauth
OAUTH_PROVIDER=auth0
OAUTH_CLIENT_ID=your-auth0-client-id
OAUTH_CLIENT_SECRET=your-auth0-client-secret
OAUTH_DOMAIN=your-tenant.auth0.com
OAUTH_AUDIENCE=https://your-api-identifier  # Optional
OAUTH_SCOPES="openid profile email offline_access"
SESSION_SECRET=your-session-secret-minimum-32-chars
BASE_URL=http://localhost:3000
```

### Keycloak

Keycloak is a free, open-source identity management solution that can be self-hosted.

#### Setup Steps

1. **Run Keycloak (Docker)**

```bash
docker run -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:latest start-dev
```

2. **Configure Keycloak**
   - Access admin console: `http://localhost:8080/admin`
   - Login with admin/admin
   - Create a new Realm (e.g., "lodgify")
   - Create a new Client:
     - Client ID: `lodgify-mcp`
     - Client Protocol: `openid-connect`
     - Access Type: `confidential`
     - Valid Redirect URIs: `http://localhost:3000/auth/callback`
   - Go to Credentials tab and copy the Secret

3. **Configure Environment**

```bash
AUTH_MODE=oauth
OAUTH_PROVIDER=keycloak
OAUTH_CLIENT_ID=lodgify-mcp
OAUTH_CLIENT_SECRET=your-keycloak-client-secret
OAUTH_BASE_URL=http://localhost:8080
OAUTH_REALM=lodgify
OAUTH_SCOPES="openid profile email offline_access"
SESSION_SECRET=your-session-secret-minimum-32-chars
BASE_URL=http://localhost:3000
```

## Docker Deployment

### Basic Docker Run

```bash
# Bearer token authentication
docker run -d \
  -e LODGIFY_API_KEY=your-lodgify-key \
  -e AUTH_MODE=bearer \
  -e MCP_TOKEN=your-bearer-token \
  -p 3000:3000 \
  lodgify-mcp-http

# OAuth authentication
docker run -d \
  -e LODGIFY_API_KEY=your-lodgify-key \
  -e AUTH_MODE=oauth \
  -e OAUTH_PROVIDER=google \
  -e OAUTH_CLIENT_ID=your-client-id \
  -e OAUTH_CLIENT_SECRET=your-client-secret \
  -e SESSION_SECRET=your-session-secret \
  -e BASE_URL=http://localhost:3000 \
  -p 3000:3000 \
  lodgify-mcp-http
```

### Docker Compose with Profiles

Use different profiles for different authentication modes:

```bash
# Bearer token mode (default)
docker-compose --profile http up

# OAuth with Google
docker-compose -f docker-compose.yml -f docker-compose.auth.yml --profile google up

# OAuth with GitHub
docker-compose -f docker-compose.yml -f docker-compose.auth.yml --profile github up

# OAuth with Auth0
docker-compose -f docker-compose.yml -f docker-compose.auth.yml --profile auth0 up

# OAuth with Keycloak (includes Keycloak server)
docker-compose -f docker-compose.yml -f docker-compose.auth.yml --profile keycloak-dev up

# Dual authentication mode
docker-compose -f docker-compose.yml -f docker-compose.auth.yml --profile dual up
```

### Environment File Example

Create a `.env` file:

```bash
# Lodgify Configuration
LODGIFY_API_KEY=your-lodgify-api-key
LODGIFY_READ_ONLY=false

# Server Configuration
NODE_ENV=production
HTTP_PORT=3000
HTTP_HOST=0.0.0.0
BASE_URL=https://your-domain.com

# Authentication
AUTH_MODE=oauth
OAUTH_PROVIDER=google
OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_SCOPES=openid profile email
SESSION_SECRET=your-secure-session-secret-minimum-32-chars

# Security
CORS_ALLOWED_ORIGINS=https://your-frontend.com
TRUST_PROXY=true  # If behind a proxy/load balancer
```

## Security Best Practices

### Token Security

1. **Strong Tokens**: Use minimum 32 characters for bearer tokens
2. **Secure Storage**: Never commit tokens to version control
3. **Token Rotation**: Regularly rotate bearer tokens
4. **HTTPS Only**: Always use HTTPS in production

### OAuth Security

1. **PKCE**: Always enabled for public clients
2. **State Parameter**: Prevents CSRF attacks
3. **Nonce Validation**: Prevents replay attacks
4. **Token Rotation**: Refresh tokens rotate on use
5. **Session Security**: Use strong session secrets

### Rate Limiting

Built-in rate limits:
- Login attempts: 5 per 15 minutes
- Token validation: 30 per minute
- General API: 100 per minute
- Token refresh: 10 per hour

### CORS Configuration

```bash
# Allow specific origins
CORS_ALLOWED_ORIGINS=https://app1.com,https://app2.com

# Allow all origins (development only)
CORS_ALLOWED_ORIGINS=*
```

### Security Headers

Automatically applied:
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security (HTTPS only)
- Referrer-Policy

## Troubleshooting

### Common Issues

#### "No authentication configured"

**Solution**: Set `AUTH_MODE` and provide appropriate credentials.

#### "Invalid bearer token"

**Solution**: Ensure token matches exactly and is at least 32 characters.

#### OAuth redirect fails

**Solution**: Verify `BASE_URL` matches your server URL and callback is registered with provider.

#### Session errors with OAuth

**Solution**: Set `SESSION_SECRET` to a secure 32+ character string.

#### CORS errors

**Solution**: Configure `CORS_ALLOWED_ORIGINS` with your frontend URLs.

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug
DEBUG_HTTP=1
```

### Health Check

Verify server status:

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "auth": {
    "mode": "oauth",
    "strategies": ["oauth"]
  },
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### OAuth Flow Testing

1. **Start Authorization**:
```bash
curl http://localhost:3000/auth/authorize?return_to=/dashboard
```

2. **Validate Token**:
```bash
curl -X POST http://localhost:3000/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"token": "your-access-token"}'
```

3. **Refresh Token**:
```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "your-refresh-token"}'
```

## Migration Guide

### From MCP_TOKEN to AUTH_MODE

1. Current setup (bearer token):
```bash
MCP_TOKEN=your-token
```

2. New setup (explicit mode):
```bash
AUTH_MODE=bearer
AUTH_BEARER_TOKEN=your-token  # or keep MCP_TOKEN
```

3. Add OAuth support (dual mode):
```bash
AUTH_MODE=dual
MCP_TOKEN=your-token  # Keep existing bearer auth
OAUTH_PROVIDER=google
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
SESSION_SECRET=your-session-secret
```

## Support

For issues or questions:
1. Check the [troubleshooting](#troubleshooting) section
2. Review server logs with `LOG_LEVEL=debug`
3. Open an issue on GitHub with sanitized configuration and error messages
