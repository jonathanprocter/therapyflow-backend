# Render.com Deployment Setup Guide

This guide will help you fix the two critical issues preventing your app from working properly on Render.com:
1. App running in demo mode (missing database user)
2. Google Calendar Error 400 (OAuth redirect URI mismatch)

---

## Prerequisites

- Render.com account with your app deployed
- Access to Render dashboard
- Google Cloud Console access
- Database connection string (DATABASE_URL)

---

## Issue #1: Fix Demo Mode (Missing Database User)

### Problem
The app uses a hardcoded therapist ID (`dr-jonathan-procter`) but this user doesn't exist in your database, causing all queries to return empty results.

### Solution

#### Option A: Run Setup Script (Recommended)

1. **Connect to your Render PostgreSQL database**:
   ```bash
   # From your local machine with DATABASE_URL set
   export DATABASE_URL="your-render-database-url"
   
   # Or connect via Render shell
   # Go to Render Dashboard → Your Service → Shell
   ```

2. **Run the setup script**:
   ```bash
   tsx scripts/setup-database-user.ts "YourSecurePassword123"
   ```

3. **Verify the user was created**:
   The script will output the user details if successful.

#### Option B: Manual SQL (Alternative)

1. **Generate password hash locally**:
   ```bash
   node -e "const bcrypt = require('bcrypt'); bcrypt.hash('YourPassword', 10).then(console.log)"
   ```

2. **Connect to your database** and run:
   ```sql
   INSERT INTO users (id, username, password, name, email, role, created_at)
   VALUES (
     'dr-jonathan-procter',
     'jonathan.procter',
     'PASTE_YOUR_BCRYPT_HASH_HERE',
     'Dr. Jonathan Procter',
     'jonathan.procter@gmail.com',
     'therapist',
     NOW()
   );
   ```

3. **Verify**:
   ```sql
   SELECT id, username, name, email FROM users WHERE id = 'dr-jonathan-procter';
   ```

---

## Issue #2: Fix Google Calendar Error 400

### Problem
The OAuth redirect URI is hardcoded for Replit, not Render.com, causing Google to reject authentication requests with Error 400.

### Solution

#### Step 1: Set Environment Variable in Render

1. Go to **Render Dashboard** → Your Service → **Environment** tab

2. Add this environment variable:
   ```
   Key: RENDER_EXTERNAL_URL
   Value: https://your-app-name.onrender.com
   ```
   *(Replace `your-app-name` with your actual Render service name)*

3. Click **Save Changes** (Render will auto-redeploy)

#### Step 2: Update Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

2. Select your **OAuth 2.0 Client ID**

3. Under **Authorized redirect URIs**, add:
   ```
   https://your-app-name.onrender.com/api/calendar/callback
   ```

4. Click **Save**

#### Step 3: Verify Environment Variables

Make sure these are all set in Render Dashboard → Environment:

```bash
# Required for Google Calendar
GOOGLE_CLIENT_ID=your-client-id-from-google-cloud-console
GOOGLE_CLIENT_SECRET=your-client-secret-from-google-cloud-console
RENDER_EXTERNAL_URL=https://your-app-name.onrender.com

# Will be set after OAuth flow
GOOGLE_REFRESH_TOKEN=will-be-generated-after-auth

# Other required variables
DATABASE_URL=postgresql://...  (auto-set by Render)
ANTHROPIC_API_KEY=your-anthropic-key
SESSION_SECRET=auto-generated
NODE_ENV=production
```

#### Step 4: Re-authenticate with Google

1. After deployment completes, visit:
   ```
   https://your-app-name.onrender.com/api/calendar/auth
   ```

2. You'll be redirected to Google OAuth consent screen

3. Grant permissions

4. Check your Render logs for the refresh token:
   ```
   💡 IMPORTANT: Save this refresh token to your environment variables as GOOGLE_REFRESH_TOKEN:
   1//0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

5. Copy that token and add it to Render environment variables:
   ```
   Key: GOOGLE_REFRESH_TOKEN
   Value: 1//0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

6. Save and let Render redeploy

---

## Verification Steps

### 1. Check Database User
```bash
# Connect to your database and run:
SELECT id, username, name FROM users WHERE id = 'dr-jonathan-procter';
```
✅ Should return one row with your user details

### 2. Check Health Endpoint
```bash
curl https://your-app-name.onrender.com/api/health
```
✅ Should return: `{"ok": true, ...}`

### 3. Check OAuth Configuration
```bash
# Check Render logs for:
"Using OAuth2 redirect URI: https://your-app-name.onrender.com/api/calendar/callback"
```
✅ Should show your Render URL, not localhost

### 4. Test Calendar Sync
```bash
# Visit your app and trigger a calendar sync
# Check Render logs for:
"Starting comprehensive calendar sync..."
```
✅ Should NOT see Error 400

---

## Troubleshooting

### "App still in demo mode"

**Possible causes:**
- Database user not created
- Wrong therapist ID in database
- Database connection issues

**Fix:**
1. Verify DATABASE_URL is set in Render
2. Run the setup script again
3. Check Render logs for database connection errors

### "Still getting Error 400 from Google"

**Possible causes:**
- RENDER_EXTERNAL_URL not set
- Wrong redirect URI in Google Cloud Console
- Using old OAuth credentials

**Fix:**
1. Double-check RENDER_EXTERNAL_URL matches your actual Render URL
2. Verify redirect URI in Google Cloud Console exactly matches
3. Make sure you're using the correct Google Cloud project
4. Try re-authenticating from scratch

### "redirect_uri_mismatch error"

**This means:**
The redirect URI in your code doesn't match Google Cloud Console

**Fix:**
1. Check Render logs for: `"Using OAuth2 redirect URI: ..."`
2. Copy that exact URL
3. Add it to Google Cloud Console → OAuth 2.0 Client → Authorized redirect URIs
4. Save and try again

---

## Summary of Changes Made

### Code Changes
1. ✅ Updated `server/services/googleCalendarService.ts`:
   - Added `getRedirectUri()` method to support Render.com
   - Now checks for `RENDER_EXTERNAL_URL` environment variable
   - Better error messages for OAuth failures

2. ✅ Added `scripts/setup-database-user.ts`:
   - Automated script to create required database user
   - Includes validation and error handling

3. ✅ Added this setup guide

### Required Actions (You Must Do)
1. ⚠️ Run database setup script or manually create user
2. ⚠️ Set RENDER_EXTERNAL_URL in Render environment variables
3. ⚠️ Update Google Cloud Console with Render redirect URI
4. ⚠️ Re-authenticate Google Calendar OAuth
5. ⚠️ Set GOOGLE_REFRESH_TOKEN in Render environment variables

---

## Next Steps

1. **Commit and push these changes to GitHub**:
   ```bash
   git add .
   git commit -m "Fix: Add Render.com support for OAuth and database setup"
   git push origin main
   ```

2. **Render will auto-deploy** the changes

3. **Follow the steps above** to:
   - Create database user
   - Set environment variables
   - Update Google Cloud Console
   - Re-authenticate

4. **Test your app** - it should now work properly!

---

## Support

If you encounter any issues:
1. Check Render logs for specific error messages
2. Verify all environment variables are set correctly
3. Ensure database user exists
4. Confirm Google Cloud Console configuration matches

---

**Last Updated:** December 29, 2025
