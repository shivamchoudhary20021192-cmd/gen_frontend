# 🐛 Bugfix - API Client Import Error

## Issue
```
Uncaught SyntaxError: The requested module '/src/api/client.ts' 
does not provide an export named 'apiClient' (at useLookups.ts:2:10)
```

## Root Cause
The `useLookups.ts` hook was importing `apiClient`, but the actual export name in `client.ts` is `api`.

## Fix Applied

### Before (Wrong)
```typescript
import { apiClient } from '../api/client';

// ...
const response = await apiClient.get<LookupsResponse>(`/lookups${params}`);
return response.data.lookups;
```

### After (Fixed)
```typescript
import { api } from '../api/client';

// ...
const response = await api.get<LookupsResponse>(`/lookups${params}`);
return response.lookups;
```

## Changes Made
1. ✅ Changed import from `apiClient` to `api`
2. ✅ Updated all API calls to use `api.get()`
3. ✅ Removed `.data` accessor (not needed)

## Files Fixed
- `src/hooks/useLookups.ts`

## Status
✅ Fixed! The hook should now work correctly.

## Test
1. Refresh browser
2. Navigate to Products → New Product
3. ✅ Dropdowns should now populate from API

---

**Error resolved! 🎉**
