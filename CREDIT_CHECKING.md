# Frontend Credit Checking Implementation

This document explains how credit checking is implemented on the frontend to prevent file uploads when users have insufficient credits.

## Overview

The frontend now checks user credits before allowing any file upload operations. This prevents unnecessary API calls and provides immediate feedback to users about their credit status.

## Components

### 1. `useCreditCheck` Hook

**Location:** `src/hooks/useCreditCheck.ts`

A reusable hook that provides credit checking functionality:

```typescript
const { hasSufficientCredits, getCurrentBalance, isProfileLoaded, profileLoading } = useCreditCheck();
```

**Functions:**
- `hasSufficientCredits(requiredCredits?)` - Check if user has enough credits (default: 1)
- `getCurrentBalance()` - Get current credit balance
- `isProfileLoaded()` - Check if user profile is loaded
- `profileLoading` - Loading state
- `profile` - User profile data

### 2. `CreditCheckModal` Component

**Location:** `src/components/CreditCheckModal.tsx`

A modal that appears when users don't have sufficient credits:

**Features:**
- Warning icon and clear messaging
- Shows current balance vs required credits
- "Get More Credits" button (can link to credits page)
- Responsive design with proper styling

### 3. Updated `AudioUploader` Component

**Location:** `src/components/AudioUploader.tsx`

Enhanced with credit checking functionality:

**New Features:**
- Credit status display at the top
- Visual indicators for insufficient credits
- Credit checking before file upload and sample music
- Modal popup for insufficient credits
- Disabled state when no credits available

## Implementation Details

### Credit Checking Flow

1. **Profile Loading:** User profile is loaded when component mounts
2. **Credit Display:** Current balance is shown with color coding (green/red)
3. **Upload Prevention:** File uploads are blocked if credits < 1
4. **Modal Display:** Insufficient credits modal appears on upload attempts
5. **Visual Feedback:** Upload area changes appearance based on credit status

### Credit Requirements

- **File Upload:** 1 credit required
- **Sample Music:** 1 credit required
- **Constants:** Defined in `useCreditCheck.ts` as `REQUIRED_CREDITS_FOR_UPLOAD`

### User Experience

**Sufficient Credits:**
- Normal upload interface
- Green credit balance display
- All functionality available

**Insufficient Credits:**
- Red credit balance display
- Warning message in upload area
- Modal popup on upload attempts
- "Get More Credits" button available

## Usage Example

```typescript
import { useCreditCheck } from '@/hooks/useCreditCheck';

function MyComponent() {
  const { hasSufficientCredits, getCurrentBalance } = useCreditCheck();

  const handleUpload = () => {
    if (!hasSufficientCredits()) {
      // Show credit modal or handle insufficient credits
      return;
    }
    
    // Proceed with upload
    uploadFile();
  };

  return (
    <div>
      <p>Credits: {getCurrentBalance()}</p>
      <button 
        onClick={handleUpload}
        disabled={!hasSufficientCredits()}
      >
        Upload File
      </button>
    </div>
  );
}
```

## Benefits

1. **Prevents Unnecessary API Calls:** Upload requests are blocked before reaching the backend
2. **Immediate User Feedback:** Users see their credit status instantly
3. **Better UX:** Clear messaging and visual indicators
4. **Reusable:** Credit checking logic can be used across components
5. **Consistent:** Same credit requirements enforced everywhere

## Future Enhancements

1. **Credit Purchase Flow:** Integrate with payment system
2. **Credit Usage Tracking:** Show credit usage history
3. **Different Credit Requirements:** Support for different operations requiring different credit amounts
4. **Credit Notifications:** Low credit warnings
5. **Credit Analytics:** Usage patterns and insights

## Testing

To test the credit checking:

1. **With Credits:** Upload should work normally
2. **Without Credits:** Upload should be blocked with modal
3. **Loading State:** Should show loading spinner while profile loads
4. **Error States:** Should handle profile loading errors gracefully

## Configuration

Credit requirements can be modified in `src/hooks/useCreditCheck.ts`:

```typescript
export const REQUIRED_CREDITS_FOR_UPLOAD = 1; // Change this value as needed
``` 