# TherapyFlow Backend Analysis - Critical Issues

## User-Reported Problems

### 1. **App Running in Demo Mode**
**Status**: ❌ CRITICAL ISSUE IDENTIFIED

### 2. **Google Calendar Error 400**
**Status**: ❌ CRITICAL ISSUE IDENTIFIED

---

## Root Cause Analysis

### Issue #1: Hardcoded Authentication (Demo Mode)

**Location**: `server/routes.ts:102-107`

**The Problem**:
```typescript
const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  // Dr. Jonathan Procter as the authenticated therapist
  (req as AuthenticatedRequest).therapistId = "dr-jonathan-procter";
  (req as AuthenticatedRequest).therapistName = "Dr. Jonathan Procter";
  next();
};
```

**Why This Causes Demo Mode**:
1. The authentication is **completely mocked** - there's no real user authentication
2. Every request is assigned the hardcoded therapist ID: `"dr-jonathan-procter"`
3. The comment says "TODO: Replace with real authentication (session-based or JWT)"
4. **This therapist ID must exist in the database** for the app to work properly

**Impact**:
- If the user with ID `"dr-jonathan-procter"` doesn't exist in the `users` table, the app will fail
- All queries filter by `therapistId`, so if this user doesn't exist, **no data will be returned**
- The app appears to be in "demo mode" because it can't find any real user data

**Database Query Example** (from `storage.ts:187-192`):
```typescript
async getClients(therapistId: string): Promise<Client[]> {
  return await db
    .select()
    .from(clients)
    .where(and(eq(clients.therapistId, therapistId), isNull(clients.deletedAt)))
    .orderBy(desc(clients.createdAt));
}
```

**The Fix Required**:
1. ✅ Check if user `"dr-jonathan-procter"` exists in the database
2. ✅ If not, create this user in the database
3. ✅ Verify all clients, sessions, and notes are associated with this therapist ID
4. ⚠️ Long-term: Implement proper authentication (session-based or JWT)

---

### Issue #2: Google Calendar OAuth Error 400

**Location**: `server/services/googleCalendarService.ts`

**The Problem**:

**Missing or Incorrect Environment Variables**:
```typescript
// Line 17-20
this.oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  redirectUri
);
```

**Redirect URI Mismatch**:
```typescript
// Line 11-13
const redirectUri = process.env.REPLIT_DOMAINS 
  ? `https://${process.env.REPLIT_DOMAINS}/api/calendar/callback`
  : 'http://localhost:5000/api/calendar/callback';
```

**Why Error 400 Occurs**:

HTTP 400 errors from Google OAuth typically mean:
1. **Invalid redirect URI** - The redirect URI in your code doesn't match what's configured in Google Cloud Console
2. **Missing credentials** - `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` not set
3. **Invalid OAuth scope** - Requesting scopes not authorized in Google Cloud Console
4. **Expired or invalid refresh token** - `GOOGLE_REFRESH_TOKEN` is stale

**Evidence from Code** (Line 43-50):
```typescript
console.log('Google OAuth2 Configuration Check:');
console.log('- Client ID:', process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...` : 'MISSING');
console.log('- Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? 'Present' : 'MISSING');

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error('Missing Google OAuth credentials. Please check your Secrets configuration.');
}
```

**Required Environment Variables**:
- `GOOGLE_CLIENT_ID` - From Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - From Google Cloud Console  
- `GOOGLE_REFRESH_TOKEN` - Generated after first OAuth flow
- `REPLIT_DOMAINS` - For redirect URI (if on Replit)

**Redirect URI Configuration**:
The code expects one of these redirect URIs:
- Production (Replit): `https://{REPLIT_DOMAINS}/api/calendar/callback`
- Local: `http://localhost:5000/api/calendar/callback`
- **Render**: This is the problem! The code doesn't handle Render.com domains

**The Fix Required**:

1. ✅ **Check Environment Variables in Render Dashboard**:
   - Verify `GOOGLE_CLIENT_ID` is set
   - Verify `GOOGLE_CLIENT_SECRET` is set
   - Verify `GOOGLE_REFRESH_TOKEN` is set (if already authenticated)

2. ✅ **Fix Redirect URI for Render.com**:
   ```typescript
   // Current code only handles REPLIT_DOMAINS
   const redirectUri = process.env.REPLIT_DOMAINS 
     ? `https://${process.env.REPLIT_DOMAINS}/api/calendar/callback`
     : 'http://localhost:5000/api/calendar/callback';
   
   // Should be:
   const redirectUri = process.env.RENDER_EXTERNAL_URL
     ? `${process.env.RENDER_EXTERNAL_URL}/api/calendar/callback`
     : process.env.REPLIT_DOMAINS 
       ? `https://${process.env.REPLIT_DOMAINS}/api/calendar/callback`
       : 'http://localhost:5000/api/calendar/callback';
   ```

3. ✅ **Update Google Cloud Console**:
   - Go to Google Cloud Console → APIs & Services → Credentials
   - Find your OAuth 2.0 Client ID
   - Add the Render.com redirect URI to "Authorized redirect URIs":
     - `https://your-render-app.onrender.com/api/calendar/callback`
     - Replace `your-render-app` with your actual Render service name

4. ✅ **Re-authenticate**:
   - After fixing redirect URI, you'll need to re-authenticate
   - Visit `/api/calendar/auth` endpoint to start OAuth flow
   - Save the new `GOOGLE_REFRESH_TOKEN` to Render environment variables

---

## Database Schema Issues

### Issue #3: Missing User Record

**The hardcoded therapist ID requires a user record to exist**:

```sql
-- This user MUST exist in the database
INSERT INTO users (id, username, password, name, email, role)
VALUES (
  'dr-jonathan-procter',
  'jonathan.procter',
  '$2b$10$...',  -- bcrypt hashed password
  'Dr. Jonathan Procter',
  'jonathan.procter@gmail.com',
  'therapist'
);
```

**How to Check**:
```sql
SELECT * FROM users WHERE id = 'dr-jonathan-procter';
```

**If this returns no results, the app will fail to load any data.**

---

## Render.com Specific Issues

### Issue #4: Environment Variables Not Configured

**Required Environment Variables for Render**:

```bash
# Database
DATABASE_URL=postgresql://...  # From Render PostgreSQL service

# Authentication (currently not used, but required for schema)
SESSION_SECRET=<auto-generated by Render>

# AI Services
ANTHROPIC_API_KEY=<your-key>

# Google Calendar OAuth
GOOGLE_CLIENT_ID=<from-google-cloud-console>
GOOGLE_CLIENT_SECRET=<from-google-cloud-console>
GOOGLE_REFRESH_TOKEN=<generated-after-oauth>

# Render-specific
RENDER_EXTERNAL_URL=https://your-app.onrender.com
NODE_ENV=production
```

**How to Set in Render**:
1. Go to Render Dashboard → Your Service
2. Click "Environment" tab
3. Add each variable above
4. Click "Save Changes"
5. Render will automatically redeploy

---

### Issue #5: Build Command Database Dependency

**Location**: `render.yaml:5`

```yaml
buildCommand: npm install && npm run db:push && npm run build:server
```

**Problem**: 
- `npm run db:push` requires `DATABASE_URL` during build time
- This can fail if database isn't ready or accessible during build

**Fix**:
```yaml
buildCommand: npm install && npm run build:server
preDeployCommand: npm run db:push
```

Or use Render's "Build Command" and "Start Command" separately:
- **Build Command**: `npm install && npm run build:server`
- **Start Command**: `npm run db:push && npm run start`

---

## Immediate Action Plan

### Step 1: Fix Database User (CRITICAL)

**Connect to your Render PostgreSQL database and run**:

```sql
-- Check if user exists
SELECT * FROM users WHERE id = 'dr-jonathan-procter';

-- If not exists, create the user
INSERT INTO users (id, username, password, name, email, role, created_at)
VALUES (
  'dr-jonathan-procter',
  'jonathan.procter',
  '$2b$10$YourHashedPasswordHere',  -- You'll need to generate this
  'Dr. Jonathan Procter',
  'jonathan.procter@gmail.com',
  'therapist',
  NOW()
)
ON CONFLICT (id) DO NOTHING;
```

**To generate the password hash**:
```javascript
// Run this in Node.js or in your app
const bcrypt = require('bcrypt');
const hash = await bcrypt.hash('your-password', 10);
console.log(hash);
```

---

### Step 2: Fix Google Calendar OAuth (CRITICAL)

**A. Update the code to support Render.com**:

Edit `server/services/googleCalendarService.ts` line 11-13:

```typescript
// OLD:
const redirectUri = process.env.REPLIT_DOMAINS 
  ? `https://${process.env.REPLIT_DOMAINS}/api/calendar/callback`
  : 'http://localhost:5000/api/calendar/callback';

// NEW:
const redirectUri = process.env.RENDER_EXTERNAL_URL
  ? `${process.env.RENDER_EXTERNAL_URL}/api/calendar/callback`
  : process.env.REPLIT_DOMAINS 
    ? `https://${process.env.REPLIT_DOMAINS}/api/calendar/callback`
    : 'http://localhost:5000/api/calendar/callback';
```

**B. Set environment variable in Render**:
```bash
RENDER_EXTERNAL_URL=https://your-app-name.onrender.com
```

**C. Update Google Cloud Console**:
1. Go to https://console.cloud.google.com/apis/credentials
2. Select your OAuth 2.0 Client ID
3. Under "Authorized redirect URIs", add:
   ```
   https://your-app-name.onrender.com/api/calendar/callback
   ```
4. Click "Save"

**D. Re-authenticate**:
1. After deploying the fix, visit: `https://your-app-name.onrender.com/api/calendar/auth`
2. Complete the OAuth flow
3. Copy the refresh token from the logs
4. Add it to Render environment variables as `GOOGLE_REFRESH_TOKEN`

---

### Step 3: Verify Environment Variables

**Check Render Dashboard → Environment**:

✅ `DATABASE_URL` - Should be set automatically if you added a PostgreSQL service  
✅ `GOOGLE_CLIENT_ID` - Must be set manually  
✅ `GOOGLE_CLIENT_SECRET` - Must be set manually  
✅ `GOOGLE_REFRESH_TOKEN` - Set after OAuth flow  
✅ `ANTHROPIC_API_KEY` - Must be set manually  
✅ `SESSION_SECRET` - Auto-generated by Render  
✅ `RENDER_EXTERNAL_URL` - Set to your Render app URL  
✅ `NODE_ENV` - Should be "production"  

---

### Step 4: Update Build Configuration

**Option A: Update render.yaml**:
```yaml
services:
  - type: web
    name: therapyflow-api
    runtime: node
    buildCommand: npm install && npm run build:server
    startCommand: npm run db:push && npm run start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: GOOGLE_CLIENT_ID
        sync: false
      - key: GOOGLE_CLIENT_SECRET
        sync: false
      - key: GOOGLE_REFRESH_TOKEN
        sync: false
      - key: RENDER_EXTERNAL_URL
        sync: false
      - key: SESSION_SECRET
        generateValue: true
    healthCheckPath: /api/health
```

**Option B: Manual Configuration in Render Dashboard**:
- Build Command: `npm install && npm run build:server`
- Start Command: `npm run db:push && npm run start`

---

## Testing Checklist

After implementing fixes:

1. ✅ **Database Connection**:
   ```bash
   curl https://your-app.onrender.com/api/health
   # Should return: {"ok": true, ...}
   ```

2. ✅ **User Exists**:
   ```bash
   # Check Render logs for any "therapist not found" errors
   ```

3. ✅ **Google OAuth Configuration**:
   ```bash
   # Visit: https://your-app.onrender.com/api/calendar/auth
   # Should redirect to Google OAuth consent screen
   ```

4. ✅ **Calendar Sync**:
   ```bash
   # After OAuth, check logs for "calendar sync" messages
   # Should not see Error 400
   ```

---

## Long-Term Recommendations

### 1. Implement Real Authentication
- Replace hardcoded `therapistId` with session-based or JWT authentication
- Add login/logout endpoints
- Store session in database or Redis

### 2. Add Database Health Check
```typescript
app.get("/api/health", async (req, res) => {
  try {
    // Test database connection
    await db.execute(sql`SELECT 1`);
    
    res.json({
      ok: true,
      database: "connected",
      version: process.env.APP_VERSION || "dev",
      time: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      database: "disconnected",
      error: error.message
    });
  }
});
```

### 3. Add Migration System
- Use Drizzle migrations instead of manual SQL files
- Track migration versions
- Automate migration on deploy

### 4. Environment-Specific Configuration
- Create separate configs for development, staging, production
- Use environment detection for redirect URIs
- Add validation for required environment variables

---

## Summary

**Root Causes**:
1. ❌ Hardcoded therapist ID that doesn't exist in database → **Demo mode**
2. ❌ Google OAuth redirect URI not configured for Render.com → **Error 400**
3. ❌ Missing environment variables in Render dashboard
4. ❌ No real authentication system implemented

**Immediate Fixes**:
1. Create user record with ID `"dr-jonathan-procter"` in database
2. Update OAuth redirect URI code to support Render.com
3. Configure Google Cloud Console with Render redirect URI
4. Set all required environment variables in Render
5. Re-authenticate Google Calendar OAuth

**Expected Outcome**:
- App will load with real data (not demo mode)
- Google Calendar will sync without Error 400
- All features will work as expected

