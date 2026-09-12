# School Management System

A production-oriented React + Firebase school operations system with a glassmorphism UX and server-side M-Pesa STK Push integration.

## Stack

- React + Vite
- Firebase Authentication
- Cloud Firestore
- Firebase Cloud Functions for M-Pesa/Daraja
- Firebase Hosting
- Lucide icons

## Features in this foundation

- Email/password authentication
- Google sign-in
- Password reset
- Private school workspace creation
- School-scoped Firestore data
- Students, classes, teachers and attendance
- Fees dashboard and payment history
- M-Pesa STK Push through a callable Firebase Function
- M-Pesa callback processing that records successful payments server-side
- Responsive glassmorphism UI with animated ambient elements
- Firestore rules that prevent browser writes to payment records

## Local setup

1. Create a Firebase project and register a web app.
2. Enable Email/Password and Google sign-in under Firebase Authentication.
3. Create a Cloud Firestore database.
4. Copy `.env.example` to `.env` and add the Firebase web configuration from the Firebase console.
5. Install dependencies:

```bash
npm install
cd functions && npm install && cd ..
```

6. Run the frontend:

```bash
npm run dev
```

## Firebase CLI

Install/login to the Firebase CLI, select the Firebase project, then deploy the rules/functions/hosting configuration:

```bash
firebase login
firebase use YOUR_FIREBASE_PROJECT_ID
npm run build
firebase deploy --only firestore:rules,functions,hosting
```

## M-Pesa / Daraja

The frontend never receives the Daraja consumer secret or passkey. Configure these as Firebase Functions secrets:

```bash
firebase functions:secrets:set MPESA_CONSUMER_KEY
firebase functions:secrets:set MPESA_CONSUMER_SECRET
firebase functions:secrets:set MPESA_PASSKEY
firebase functions:secrets:set MPESA_SHORTCODE
firebase functions:secrets:set MPESA_CALLBACK_URL
```

`MPESA_CALLBACK_URL` must point to the deployed `mpesaCallback` HTTPS function URL. Obtain the URL after the first functions deployment, then set the secret and redeploy the function.

The `initiateStkPush` callable function validates the signed-in administrator, verifies school ownership, normalizes Kenyan phone numbers, obtains a Daraja access token, initiates the STK request, and stores a pending payment request. The `mpesaCallback` endpoint validates the callback shape, updates the request, and records successful payments in Firestore.

For the Safaricom developer portal and current Daraja documentation, see the official portal: https://developer.safaricom.co.ke/

## Firestore model

```text
users/{uid}
  uid
  email
  displayName
  role
  schoolId

schools/{schoolId}
  name
  ownerId
  currency
  mpesaShortCode
  createdAt
  updatedAt

schools/{schoolId}/students/{studentId}
schools/{schoolId}/classes/{classId}
schools/{schoolId}/teachers/{teacherId}
schools/{schoolId}/attendance/{attendanceId}
schools/{schoolId}/payments/{paymentId}
schools/{schoolId}/paymentRequests/{requestId}
```

Payment documents are written by the trusted backend callback rather than directly by the browser.

## Production hardening checklist

- Enable Firebase App Check for the web app.
- Keep all Daraja credentials in Functions secrets.
- Enable billing/required Firebase plan for production Cloud Functions and Firestore usage.
- Configure the correct Daraja callback URL in the M-Pesa configuration.
- Test the full payment lifecycle in the Daraja sandbox before requesting/using production credentials.
- Add staff membership documents and role-based rules before giving non-owner staff access.
- Add audit logs for sensitive administrative actions.
- Add automated tests for Firestore rules and payment callbacks.
