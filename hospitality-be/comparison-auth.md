# Authentication Providers Comparison

## Target Stack

-   Backend: Python REST API (FastAPI/Django/Flask)
-   Web: Next.js
-   Mobile: React Native

## Executive Summary

| Criteria               | SuperTokens | Logto    | Zitadel     | Keycloak |
| ---------------------- | ----------- | -------- | ----------- | -------- |
| PostgreSQL Support     | ✅           | ✅ Native | ✅           | ✅        |
| Easy to Integrate      | ⭐⭐⭐⭐⭐       | ⭐⭐⭐⭐     | ⭐⭐⭐         | ⭐⭐       |
| Python Backend         | ⭐⭐⭐⭐⭐       | ⭐⭐⭐⭐     | ⭐⭐⭐⭐        | ⭐⭐⭐⭐     |
| Next.js                | ⭐⭐⭐⭐⭐       | ⭐⭐⭐⭐⭐    | ⭐⭐⭐⭐        | ⭐⭐⭐      |
| React Native           | ⭐⭐⭐⭐⭐       | ⭐⭐⭐⭐     | ⭐⭐⭐⭐        | ⭐⭐⭐      |
| Multi-role             | ✅           | ✅        | ✅           | ✅        |
| Organizations          | ✅           | ✅        | ✅           | Limited  |
| Social Login           | ✅           | ✅        | ✅           | ✅        |
| Passkeys               | ✅           | ✅        | ✅           | ✅        |
| Self-host              | ✅           | ✅        | ✅           | ✅        |
| Learning Curve         | Low         | Medium   | High        | High     |
| Operational Complexity | Low         | Medium   | Medium-High | High     |


## Feature Comparison

  ------------------------------------------------------------------------------------------
  Feature          SuperTokens    Logto    Zitadel   Keycloak     Ory      Clerk     Auth0
  --------------- ------------- --------- --------- ---------- --------- --------- ---------
  Self-host             ✓           ✓         ✓         ✓          ✓         ✗         ✗

  Hosted                ✓           ✓         ✓         ✗          ✓         ✓         ✓

  Python                ✓           ✓         ✓         ✓          ✓         ✓         ✓

  Next.js               ✓           ✓         ✓         ✓          ✓         ✓         ✓

  React Native          ✓           ✓         ✓         ✓          ✓         ✓         ✓

  OAuth/OIDC            ✓           ✓         ✓         ✓          ✓         ✓         ✓

  Social Login          ✓           ✓         ✓         ✓          ✓         ✓         ✓

  Passkeys              ✓           ✓         ✓         ✓       Partial      ✓         ✓

  MFA                   ✓           ✓         ✓         ✓       Partial      ✓         ✓

  RBAC                  ✓           ✓         ✓         ✓          ✓         ✓         ✓

  Multi-tenancy         ✓           ✓         ✓      Partial    Manual       ✓         ✓
  ------------------------------------------------------------------------------------------

## Deployment Challenges

### SuperTokens

-   HTTPS configuration
-   Cookie/session configuration
-   SMTP provider
-   Optional Redis for scale

### Logto

-   PostgreSQL + Redis
-   OIDC learning curve
-   Reverse proxy
-   SMTP

### Zitadel

-   Best with Kubernetes
-   Database planning
-   Enterprise networking
-   More operational complexity

### Keycloak

-   Java memory usage
-   Slow startup
-   Upgrade planning
-   Theme customization complexity

### Ory

-   Multiple services
-   Reverse proxy
-   Redis
-   Higher DevOps overhead

### Clerk/Auth0

-   Vendor lock-in
-   Pricing at scale
-   Data residency considerations

## Recommendation

### Best overall

1.  SuperTokens
2.  Logto
3.  Zitadel

### Enterprise

-   Zitadel
-   Keycloak
-   Auth0

### Fastest MVP

-   Clerk
-   Auth0

### Lowest operational overhead (self-hosted)

-   SuperTokens
