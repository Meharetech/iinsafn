# Clear All Payments and Wallets API

## ⚠️ DANGER ZONE - DESTRUCTIVE OPERATION ⚠️

This API is used to **permanently delete all payment history** and **reset all user wallets to zero**. Use with extreme caution!

## Database Collections

The following MongoDB collections are affected:

1. **PaymentHistory Collection**
   - Collection Name: `paymenthistories` (Mongoose automatically pluralizes and lowercases)
   - Model Name: `PaymentHistory`
   - Schema File: `b/models/paymentHistory/paymentHistory.js`

2. **Wallet Collection**
   - Collection Name: `wallets` (Mongoose automatically pluralizes and lowercases)
   - Model Name: `Wallet`
   - Schema File: `b/models/Wallet/walletSchema.js`

## API Endpoints

### 1. Get Summary (Before Clearing)

**GET** `/admin/payments-wallets/summary`

**Authentication Required:** Admin (SuperAdmin only)

**Description:** Get a summary of current payment history and wallet status before clearing.

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentHistory": {
      "totalRecords": 156
    },
    "wallets": {
      "totalWallets": 45,
      "walletsWithBalance": 12,
      "totalWalletBalance": 50000,
      "walletsWithTransactions": 30,
      "totalTransactions": 250
    }
  }
}
```

### 2. Clear All Payments and Wallets

**DELETE** `/admin/clear/all/payments-and-wallets`

**Authentication Required:** Admin (SuperAdmin only)

**Description:** 
- Deletes ALL payment history records from the database
- Resets ALL wallet balances to 0
- Clears ALL wallet transactions

**⚠️ WARNING:** This operation is **IRREVERSIBLE**. All payment history and wallet data will be permanently lost.

**Response:**
```json
{
  "success": true,
  "message": "All payment history cleared and all wallets reset to zero successfully",
  "data": {
    "deletedPaymentHistory": 156,
    "updatedWallets": 45,
    "before": {
      "paymentHistoryCount": 156,
      "walletCount": 45
    },
    "after": {
      "remainingPaymentHistory": 0,
      "walletsWithNonZeroBalance": 0,
      "walletsWithTransactions": 0
    }
  }
}
```

## Usage Example

### Step 1: Check current status
```bash
curl -X GET http://localhost:5005/admin/payments-wallets/summary \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Step 2: Clear all data (DESTRUCTIVE)
```bash
curl -X DELETE http://localhost:5005/admin/clear/all/payments-and-wallets \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## What Gets Cleared

1. **Payment History:**
   - All records from `paymenthistories` collection
   - Includes: paymentId, amount, GST, method, status, dates, user references

2. **Wallets:**
   - All wallet balances set to `0`
   - All transactions arrays cleared (empty array `[]`)
   - Wallet documents remain but with zero balance and no transactions

## Security

- ✅ Requires admin authentication (`adminAuthenticate` middleware)
- ✅ Requires superadmin role (`isSuperAdmin` middleware)
- ✅ Only superadmin can access these endpoints

## Files Created

1. **Controller:** `b/controller/admin/clearAllPaymentsAndWallets.js`
2. **Routes:** Added to `b/routes/adminRoutes/adminAuth/adminAuth.js`

## Testing

After running the clear operation, verify:
1. Payment history count should be 0
2. All wallet balances should be 0
3. All wallet transactions should be empty arrays

Use the summary endpoint to verify the results.

