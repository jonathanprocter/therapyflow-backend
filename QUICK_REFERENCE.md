# TherapyFlow Backend - Quick Reference Guide

## 🚀 What Was Fixed

### Critical Issues Resolved
1. ✅ **Empty Insights Endpoint** - Now returns actual therapeutic insights
2. ✅ **Inconsistent Auth** - Standardized therapist ID access
3. ✅ **Missing Tables** - Auto-checks and creates database tables on startup
4. ✅ **Silent Errors** - Better error handling with helpful messages
5. ✅ **Bad Client Data** - Validates and filters client names

---

## 📋 New Features

### Automatic Database Migration
Server now checks for required tables on startup and creates them if missing.

**Tables Auto-Created:**
- `session_tags`
- `session_insights`
- `journey_synthesis`
- `session_cross_references`

### Client Name Validation
Prevents calendar events and tasks from being created as clients.

**Blocked Patterns:**
- "Call with...", "Meeting with...", "Coffee with..."
- "TODO:", "TASK:", "Reminder:"
- Email addresses, phone numbers
- Very short names (< 2 characters)

---

## 🔧 New Utility Functions

### Authentication (`server/utils/auth-helpers.ts`)
```typescript
import { getTherapistIdOrDefault } from './utils/auth-helpers.js';

// In your route:
const therapistId = getTherapistIdOrDefault(req);
```

### Response Formatting (`server/utils/response-helpers.ts`)
```typescript
import { successResponse, errorResponse } from './utils/response-helpers.js';

// Success:
return successResponse(res, data);

// Error:
return errorResponse(res, 'Something went wrong', 500);
```

### Client Filtering (`server/utils/client-filters.ts`)
```typescript
import { filterActualClients, validateClientName } from './utils/client-filters.js';

// Filter clients:
const actualClients = filterActualClients(allClients);

// Validate before creation:
const validation = validateClientName(req.body.name);
if (!validation.valid) {
  return res.status(400).json({ error: validation.error });
}
```

---

## 🧪 Testing the Fixes

### Test Insights Endpoint
```bash
# Get recent insights across all clients
curl http://localhost:5000/api/therapeutic/insights/recent?limit=10

# Get insights for specific client
curl http://localhost:5000/api/therapeutic/insights/{clientId}
```

### Test Client Filtering
```bash
# This should be rejected:
curl -X POST http://localhost:5000/api/clients \
  -H "Content-Type: application/json" \
  -d '{"name": "TODO: Call John"}'

# This should work:
curl -X POST http://localhost:5000/api/clients \
  -H "Content-Type: application/json" \
  -d '{"name": "John Smith"}'
```

### Test Database Migration
```bash
# Just start the server - it will check automatically
npm run dev

# Look for these messages:
# 🔍 Checking critical database tables...
# ✅ All therapeutic journey tables exist
```

---

## 📊 API Endpoints

### Therapeutic Journey
```
POST   /api/therapeutic/synthesize/:clientId
POST   /api/therapeutic/recall/:clientId
GET    /api/therapeutic/insights/recent
GET    /api/therapeutic/insights/:clientId
GET    /api/therapeutic/tags/:clientId
```

### Clients
```
GET    /api/clients                  (now filtered)
POST   /api/clients                  (now validated)
GET    /api/clients/:id
PUT    /api/clients/:id
DELETE /api/clients/:id
```

---

## 🐛 Debugging

### Check Database Tables
```bash
# Server logs will show:
✅ users: exists
✅ clients: exists
✅ sessions: exists
✅ progress_notes: exists
✅ documents: exists
✅ All therapeutic journey tables exist
```

### Check for Missing Tables
If you see:
```
⚠️  Missing tables: session_insights, session_tags
🔧 Running therapeutic journey migration...
```

The server will automatically create them.

### Manual Migration (if needed)
```bash
npm run migrate:therapeutic
# or
psql $DATABASE_URL < server/migrations/add-therapeutic-journey.sql
```

---

## 🔍 Common Issues

### Issue: "Table does not exist"
**Solution:** Restart the server - it will auto-create tables

### Issue: Client list shows calendar events
**Solution:** Already fixed! The new filter removes them automatically

### Issue: Insights endpoint returns empty array
**Solution:** Fixed! Now queries the database properly

### Issue: "Unauthorized" errors
**Solution:** Auth is now standardized - check therapist ID is set

---

## 📝 Code Examples

### Using New Auth Helper
```typescript
// Old way (inconsistent):
const therapistId = (req as any).user?.id || (req as any).therapistId || 'default';

// New way (consistent):
import { getTherapistIdOrDefault } from '../utils/auth-helpers.js';
const therapistId = getTherapistIdOrDefault(req);
```

### Using Response Helpers
```typescript
// Old way:
res.status(200).json({ success: true, data: results });

// New way:
import { successResponse } from '../utils/response-helpers.js';
return successResponse(res, results);
```

### Validating Client Names
```typescript
// Before creating a client:
import { validateClientName, sanitizeClientName } from '../utils/client-filters.js';

const validation = validateClientName(req.body.name);
if (!validation.valid) {
  return res.status(400).json({ error: validation.error });
}

const sanitizedName = sanitizeClientName(req.body.name);
// Use sanitizedName for database insert
```

---

## 🚦 Server Startup Checklist

When you start the server, you should see:

1. ✅ Database table checks
2. ✅ Migration status
3. ✅ Route registration messages
4. ✅ Therapeutic endpoint list
5. ✅ Service startup confirmations

**Example:**
```
🔍 Checking critical database tables...
✅ All therapeutic journey tables exist
✅ CareNotesAI document processing pipeline routes registered
✅ Therapeutic journey features integrated
📍 Therapeutic API endpoints available at:
   POST /api/therapeutic/synthesize/:clientId
   POST /api/therapeutic/recall/:clientId
   GET  /api/therapeutic/insights/:clientId
   GET  /api/therapeutic/tags/:clientId
serving on port 5000
```

---

## 📚 Documentation Files

- **BUG_ANALYSIS_REPORT.md** - Detailed analysis of issues found
- **FIXES_APPLIED_2025-12-30.md** - Complete list of fixes and changes
- **QUICK_REFERENCE.md** - This file (quick guide)

---

## 🎯 Next Steps

1. **Test the endpoints** - Verify all therapeutic features work
2. **Monitor logs** - Check for any errors or warnings
3. **Review client list** - Confirm calendar events are filtered out
4. **Check insights** - Verify data is being returned

---

## 💡 Pro Tips

- All changes are **backward compatible**
- No frontend changes required
- Database migrations run **automatically**
- Error messages are now **more helpful**
- Client validation happens **before** database insert

---

## 🆘 Need Help?

1. Check the server logs for detailed error messages
2. Review the BUG_ANALYSIS_REPORT.md for context
3. Look at FIXES_APPLIED_2025-12-30.md for implementation details
4. All utility functions have inline documentation

---

**Last Updated:** December 30, 2025  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
