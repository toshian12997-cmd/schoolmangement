const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const MPESA_CONSUMER_KEY = defineSecret('MPESA_CONSUMER_KEY');
const MPESA_CONSUMER_SECRET = defineSecret('MPESA_CONSUMER_SECRET');
const MPESA_PASSKEY = defineSecret('MPESA_PASSKEY');
const MPESA_SHORTCODE = defineSecret('MPESA_SHORTCODE');
const MPESA_CALLBACK_URL = defineSecret('MPESA_CALLBACK_URL');

function normalizePhone(input) {
  let p = String(input || '').replace(/\s|\+|-/g, '');
  if (p.startsWith('07') || p.startsWith('01')) p = `254${p.slice(1)}`;
  if (p.startsWith('7') || p.startsWith('1')) p = `254${p}`;
  if (!/^254[71]\d{8}$/.test(p)) throw new HttpsError('invalid-argument', 'Use a valid Kenyan M-Pesa number.');
  return p;
}

function base64(value) { return Buffer.from(value).toString('base64'); }
function timestamp() { const d = new Date(); const pad = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`; }

async function getAccessToken() {
  const credentials = base64(`${MPESA_CONSUMER_KEY.value()}:${MPESA_CONSUMER_SECRET.value()}`);
  const response = await fetch('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', { headers: { Authorization: `Basic ${credentials}` } });
  if (!response.ok) throw new Error(`Daraja OAuth failed (${response.status})`);
  const data = await response.json();
  return data.access_token;
}

exports.initiateStkPush = onCall({ secrets: [MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_PASSKEY, MPESA_SHORTCODE, MPESA_CALLBACK_URL], region: 'us-central1', enforceAppCheck: true }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to request a payment.');
  const { schoolId, studentId, phone, amount, accountReference, transactionDesc } = request.data || {};
  if (!schoolId || !studentId || !phone || !amount) throw new HttpsError('invalid-argument', 'schoolId, studentId, phone and amount are required.');
  const numericAmount = Math.floor(Number(amount));
  if (!Number.isFinite(numericAmount) || numericAmount < 1) throw new HttpsError('invalid-argument', 'Amount must be a positive whole number.');

  const userSnap = await db.doc(`users/${request.auth.uid}`).get();
  if (!userSnap.exists || userSnap.data().schoolId !== schoolId) throw new HttpsError('permission-denied', 'You do not have access to this school.');
  const studentRef = db.doc(`schools/${schoolId}/students/${studentId}`);
  const studentSnap = await studentRef.get();
  if (!studentSnap.exists) throw new HttpsError('not-found', 'Student was not found.');

  const normalizedPhone = normalizePhone(phone);
  const token = await getAccessToken();
  const time = timestamp();
  const shortcode = MPESA_SHORTCODE.value();
  const password = base64(`${shortcode}${MPESA_PASSKEY.value()}${time}`);
  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: time,
    TransactionType: 'CustomerPayBillOnline',
    Amount: numericAmount,
    PartyA: normalizedPhone,
    PartyB: shortcode,
    PhoneNumber: normalizedPhone,
    CallBackURL: MPESA_CALLBACK_URL.value(),
    AccountReference: String(accountReference || studentId).slice(0, 12),
    TransactionDesc: String(transactionDesc || 'School fees').slice(0, 13),
  };
  const response = await fetch('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok || data.ResponseCode !== '0') throw new HttpsError('failed-precondition', data.errorMessage || data.ResponseDescription || 'Daraja rejected the STK Push.');

  await db.collection(`schools/${schoolId}/paymentRequests`).add({
    studentId, studentName: studentSnap.data().name || '', phone: normalizedPhone, amount: numericAmount,
    merchantRequestId: data.MerchantRequestID || null, checkoutRequestId: data.CheckoutRequestID || null,
    status: 'pending', createdBy: request.auth.uid, createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true, message: `M-Pesa prompt sent to ${normalizedPhone}.`, checkoutRequestId: data.CheckoutRequestID };
});

exports.mpesaCallback = onRequest({ region: 'us-central1' }, async (req, res) => {
  try {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) return res.status(400).json({ ResultCode: 1, ResultDesc: 'Invalid callback body' });
    const checkoutId = callback.CheckoutRequestID;
    const requests = await db.collectionGroup('paymentRequests').where('checkoutRequestId', '==', checkoutId).limit(1).get();
    if (requests.empty) return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

    const requestRef = requests.docs[0].ref;
    const requestData = requests.docs[0].data();
    const code = callback.CallbackMetadata?.Item?.find(x => x.Name === 'MpesaReceiptNumber')?.Value || null;
    const paidAmount = Number(callback.CallbackMetadata?.Item?.find(x => x.Name === 'Amount')?.Value || requestData.amount || 0);
    const success = Number(callback.ResultCode) === 0;
    const schoolId = requestRef.parent.parent.id;

    await db.runTransaction(async tx => {
      tx.update(requestRef, { status: success ? 'completed' : 'failed', resultCode: callback.ResultCode, resultDescription: callback.ResultDesc || '', mpesaReceiptNumber: code, completedAt: admin.firestore.FieldValue.serverTimestamp() });
      if (!success) return;
      const studentRef = db.doc(`schools/${schoolId}/students/${requestData.studentId}`);
      const paymentRef = db.collection(`schools/${schoolId}/payments`).doc();
      tx.set(paymentRef, { studentId: requestData.studentId, studentName: requestData.studentName || '', amount: paidAmount, code, phone: requestData.phone, checkoutRequestId: checkoutId, status: 'completed', paidAt: admin.firestore.FieldValue.serverTimestamp(), source: 'mpesa-stk' });
      const studentSnap = await tx.get(studentRef);
      if (studentSnap.exists) tx.update(studentRef, { paid: admin.firestore.FieldValue.increment(paidAmount), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('M-Pesa callback error', error);
    return res.status(500).json({ ResultCode: 1, ResultDesc: 'Callback processing failed' });
  }
});
