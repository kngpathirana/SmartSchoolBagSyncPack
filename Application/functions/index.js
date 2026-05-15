const { onValueCreated } = require('firebase-functions/v2/database');
const { defineString }   = require('firebase-functions/params');
const admin  = require('firebase-admin');
const twilio = require('twilio');

admin.initializeApp();

// Set these with:  firebase functions:secrets:set TWILIO_SID etc.
const TWILIO_SID    = defineString('TWILIO_SID');
const TWILIO_TOKEN  = defineString('TWILIO_TOKEN');
const TWILIO_FROM   = defineString('TWILIO_FROM');   // e.g. "+15017122661"

/**
 * Fires whenever a new SOS alert is created under bags/{bagId}/sos_alerts/{alertId}.
 * Sends an SMS to every contact number in the alert payload.
 */
exports.sendSOSSms = onValueCreated(
  {
    ref:      '/bags/{bagId}/sos_alerts/{alertId}',
    region:   'us-central1',
    instance: 'smart-school-bag-tracker-default-rtdb',
  },
  async (event) => {
    const alert   = event.data.val();
    const bagId   = event.params.bagId;
    const alertId = event.params.alertId;

    if (!alert) return;

    const contacts = Array.isArray(alert.contacts) ? alert.contacts : [];
    const message  = alert.message
      || `SOS Alert! ${alert.studentName || 'Student'}'s school bag sent an emergency alert. Location: ${alert.location?.address || 'Unknown'}`;

    if (contacts.length === 0) {
      console.warn('SOS alert has no contacts — skipping SMS');
      await event.data.ref.update({ status: 'no_contacts' });
      return;
    }

    const client = twilio(TWILIO_SID.value(), TWILIO_TOKEN.value());

    const results = await Promise.allSettled(
      contacts.map(phone =>
        client.messages.create({
          body: message,
          from: TWILIO_FROM.value(),
          to:   phone,
        })
      )
    );

    const sent   = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    results.forEach((r, i) => {
      if (r.status === 'rejected')
        console.error(`SMS to ${contacts[i]} failed:`, r.reason?.message);
    });

    // Write result back to Firebase so the app can show the real status
    await admin.database()
      .ref(`/bags/${bagId}/sos_alerts/${alertId}`)
      .update({
        status:    failed === 0 ? 'sms_sent' : sent > 0 ? 'sms_partial' : 'sms_failed',
        smsSent:   sent,
        smsFailed: failed,
        sentAt:    admin.database.ServerValue.TIMESTAMP,
      });
  }
);
