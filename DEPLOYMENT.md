# Veylog Admin Frontend - AWS Deployment Guide

## Overview
Vite/React SPA deployment to AWS S3 + CloudFront for optimal performance and cost efficiency.

## Architecture
```
User → CloudFront → S3 → Static Files (HTML, JS, CSS)
                     ↓
                  API Gateway/ALB → Backend API
```

## Prerequisites

### 1. AWS Services Required
- **S3** - Static website hosting
- **CloudFront** - CDN for global distribution
- **Route 53** - DNS management
- **ACM** - SSL certificate
- **IAM** - Access management

### 2. Bitbucket Repository Variables

Add in **Repository Settings → Pipelines → Repository variables**:

```
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
AWS_REGION=ap-south-1

# Staging
STAGING_CF_DISTRIBUTION_ID=E1XXXXX

# Production  
PRODUCTION_CF_DISTRIBUTION_ID=E2XXXXX
```

## Setup Steps

### 1. Create S3 Buckets

**Staging Bucket:**
```bash
aws s3 mb s3://veylog-admin-staging --region ap-south-1
```

**Production Bucket:**
```bash
aws s3 mb s3://veylog-admin-production --region ap-south-1
```

### 2. Configure S3 for Static Website Hosting

```bash
# Enable static website hosting
aws s3 website s3://veylog-admin-production \
  --index-document index.html \
  --error-document index.html
```

**Bucket Policy** (allows CloudFront access):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::veylog-admin-production/*"
    }
  ]
}
```

### 3. Request SSL Certificate (ACM)

```bash
# Request certificate in us-east-1 (required for CloudFront)
aws acm request-certificate \
  --domain-name admin.veylog.com \
  --validation-method DNS \
  --region us-east-1
```

Validate via Route 53:
- Copy CNAME records from ACM
- Add to Route 53 hosted zone
- Wait for validation (5-30 minutes)

### 4. Create CloudFront Distribution

**Via AWS Console:**
1. Go to CloudFront → Create Distribution
2. **Origin Settings:**
   - Origin Domain: `veylog-admin-production.s3-website.ap-south-1.amazonaws.com`
   - Protocol: HTTP only
3. **Default Cache Behavior:**
   - Viewer Protocol Policy: Redirect HTTP to HTTPS
   - Allowed HTTP Methods: GET, HEAD, OPTIONS
   - Cache Policy: CachingOptimized
4. **Settings:**
   - Alternate Domain Names: `admin.veylog.com`
   - SSL Certificate: Custom (select ACM certificate)
   - Default Root Object: `index.html`
5. **Custom Error Responses:**
   - 403 → /index.html (200) - for SPA routing
   - 404 → /index.html (200) - for SPA routing

**Via AWS CLI:**
```bash
# Create distribution
aws cloudfront create-distribution \
  --origin-domain-name veylog-admin-production.s3-website.ap-south-1.amazonaws.com \
  --default-root-object index.html
```

Note the Distribution ID for pipeline configuration.

### 5. Configure Route 53

```bash
# Create A record pointing to CloudFront
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1XXXXX \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "admin.veylog.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "d1234.cloudfront.net",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

### 6. Update Build Configuration

**Environment Variables** (.env.production):
```env
VITE_API_URL=https://api.veylog.com/admin/api/v1
VITE_APP_ENV=production
VITE_ENABLE_ANALYTICS=true
```

Make sure these are in your build process.

### 7. Build Configuration for SPA Routing

**vite.config.ts** - Ensure proper configuration:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@mui/icons-material']
        }
      }
    }
  }
})
```

## Deployment Process

### Manual Deployment

**Build Locally:**
```bash
npm run build
```

**Upload to S3:**
```bash
aws s3 sync dist/ s3://veylog-admin-production \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html"

# Upload index.html separately (no cache)
aws s3 cp dist/index.html s3://veylog-admin-production/index.html \
  --cache-control "no-cache, no-store, must-revalidate"
```

**Invalidate CloudFront Cache:**
```bash
aws cloudfront create-invalidation \
  --distribution-id E2XXXXX \
  --paths "/*"
```

### Automated Deployment (Bitbucket Pipelines)

The pipeline automatically:
- **develop branch** → Deploys to staging (manual trigger)
- **main branch** → Deploys to production (manual trigger)

Just push to the branch and approve the deployment in Bitbucket Pipelines.

## Rollback Strategy

### Quick Rollback
```bash
# List previous versions
aws s3api list-object-versions \
  --bucket veylog-admin-production \
  --prefix index.html

# Restore previous version
aws s3api copy-object \
  --copy-source veylog-admin-production/index.html?versionId=OLD_VERSION_ID \
  --bucket veylog-admin-production \
  --key index.html

# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id E2XXXXX \
  --paths "/*"
```

### S3 Versioning (Enable for rollback capability)
```bash
aws s3api put-bucket-versioning \
  --bucket veylog-admin-production \
  --versioning-configuration Status=Enabled
```

## Performance Optimization

### 1. Cache Headers
```bash
# JavaScript/CSS (immutable)
--cache-control "public, max-age=31536000, immutable"

# HTML (no cache)
--cache-control "no-cache, no-store, must-revalidate"

# Images
--cache-control "public, max-age=604800"
```

### 2. Gzip Compression
CloudFront automatically compresses content. Ensure content-type headers are correct.

### 3. Code Splitting
Already configured in Vite config with `manualChunks`.

### 4. CloudFront Optimization
- Enable Brotli compression
- Use Price Class: Use Only North America, Europe, Asia
- Enable HTTP/2 and HTTP/3

## Monitoring

### CloudWatch Alarms

```bash
# Create alarm for 4xx errors
aws cloudwatch put-metric-alarm \
  --alarm-name veylog-admin-4xx-errors \
  --alarm-description "Alert on 4xx errors" \
  --metric-name 4xxErrorRate \
  --namespace AWS/CloudFront \
  --statistic Average \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold
```

### CloudFront Access Logs

Enable logging to S3:
```bash
aws cloudfront update-distribution \
  --id E2XXXXX \
  --logging-config '{
    "Enabled": true,
    "IncludeCookies": false,
    "Bucket": "veylog-logs.s3.amazonaws.com",
    "Prefix": "cloudfront/admin/"
  }'
```

## Security

### 1. CloudFront Security Headers

Add via Lambda@Edge or CloudFront Functions:
```javascript
function handler(event) {
    var response = event.response;
    var headers = response.headers;
    
    headers['strict-transport-security'] = { value: 'max-age=31536000; includeSubdomains; preload' };
    headers['x-content-type-options'] = { value: 'nosniff' };
    headers['x-frame-options'] = { value: 'DENY' };
    headers['x-xss-protection'] = { value: '1; mode=block' };
    headers['referrer-policy'] = { value: 'strict-origin-when-cross-origin' };
    
    return response;
}
```

### 2. WAF (Optional)

Protect against common attacks:
```bash
aws wafv2 create-web-acl \
  --name veylog-admin-waf \
  --scope CLOUDFRONT \
  --default-action Allow={} \
  --rules file://waf-rules.json
```

### 3. Restrict Access (Optional)

Use CloudFront signed URLs or Lambda@Edge for authentication.

## Troubleshooting

### Issue: 403 Forbidden on Routes
**Solution:** Ensure CloudFront custom error pages redirect 403/404 to index.html

### Issue: Old content after deployment
**Solution:** Invalidate CloudFront cache or wait for TTL expiry

### Issue: CORS errors
**Solution:** Configure CORS on backend API, not S3

## Cost Estimation (Monthly - India Region)

- S3 Storage (5GB): ₹10
- S3 Requests: ₹20
- CloudFront (1TB transfer): ₹600
- Route 53: ₹40
- **Total: ~₹670/month**

## URLs

- **Production:** https://admin.veylog.com
- **Staging:** https://staging-admin.veylog.com
- **CloudFront:** https://d1234.cloudfront.net

## Checklist

- [ ] S3 buckets created (staging + production)
- [ ] CloudFront distributions created
- [ ] SSL certificates validated and attached
- [ ] Route 53 DNS records configured
- [ ] Bitbucket pipeline variables set
- [ ] Error pages configured for SPA routing
- [ ] Cache invalidation tested
- [ ] Monitoring and alarms set up
- [ ] Security headers configured
- [ ] Test deployment to staging successful
