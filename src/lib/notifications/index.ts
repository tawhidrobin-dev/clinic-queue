import { db } from '@/src/db';
import { notificationLogs } from '@/src/db/schema';

export type NotificationChannel = 'SMS' | 'WHATSAPP' | 'BOTH';

export interface SendNotificationParams {
  to: string; // E.164 phone number e.g. +8801XXXXXXXXX
  message: string;
  channel?: NotificationChannel;
  appointmentId?: string;
}

export interface DispatchResult {
  success: boolean;
  channel: 'SMS' | 'WHATSAPP';
  provider: string;
  messageId?: string;
  error?: string;
}

/**
 * -------------------------------------------------------------
 * 1. PHONE SMS DISPATCHERS (Twilio & SSL Wireless)
 * -------------------------------------------------------------
 */

async function sendViaTwilioSms(to: string, message: string): Promise<DispatchResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio SMS credentials not configured');
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({
    To: to,
    From: fromNumber,
    Body: message,
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Twilio SMS failed');

  return {
    success: true,
    channel: 'SMS',
    provider: 'TWILIO_SMS',
    messageId: data.sid,
  };
}

async function sendViaSslWirelessSms(to: string, message: string): Promise<DispatchResult> {
  const apiToken = process.env.SSL_WIRELESS_API_TOKEN;
  const sid = process.env.SSL_WIRELESS_SID;
  const domain = process.env.SSL_WIRELESS_DOMAIN || 'https://smsplus.sslwireless.com';

  if (!apiToken || !sid) {
    throw new Error('SSL Wireless credentials not configured');
  }

  const cleanMsisdn = to.replace(/[^0-9]/g, '');
  const payload = {
    api_token: apiToken,
    sid: sid,
    msisdn: cleanMsisdn,
    sms: message,
    csms_id: `CQ_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
  };

  const response = await fetch(`${domain}/api/v3/send-sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || (data.status_code && data.status_code !== 200 && data.status !== 'SUCCESS')) {
    throw new Error(data.error_message || data.status_message || 'SSL Wireless SMS failed');
  }

  return {
    success: true,
    channel: 'SMS',
    provider: 'SSL_WIRELESS',
    messageId: data.smsinfo?.[0]?.sms_id || payload.csms_id,
  };
}

/**
 * -------------------------------------------------------------
 * 2. WHATSAPP DISPATCHERS (Twilio WhatsApp & Meta Cloud API)
 * -------------------------------------------------------------
 */

async function sendViaTwilioWhatsApp(to: string, message: string): Promise<DispatchResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromWhatsApp = process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromWhatsApp) {
    throw new Error('Twilio WhatsApp credentials not configured');
  }

  const fromFormatted = fromWhatsApp.startsWith('whatsapp:')
    ? fromWhatsApp
    : `whatsapp:${fromWhatsApp}`;
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({
    To: toFormatted,
    From: fromFormatted,
    Body: message,
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Twilio WhatsApp failed');

  return {
    success: true,
    channel: 'WHATSAPP',
    provider: 'TWILIO_WHATSAPP',
    messageId: data.sid,
  };
}

async function sendViaMetaWhatsApp(to: string, message: string): Promise<DispatchResult> {
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error('Meta WhatsApp Cloud credentials not configured');
  }

  const cleanRecipient = to.replace(/[^0-9]/g, '');

  const endpoint = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanRecipient,
    type: 'text',
    text: { preview_url: true, body: message },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || 'Meta WhatsApp Cloud API failed');
  }

  return {
    success: true,
    channel: 'WHATSAPP',
    provider: 'META_WHATSAPP',
    messageId: data.messages?.[0]?.id,
  };
}

/**
 * -------------------------------------------------------------
 * 3. UNIFIED DISPATCH SERVICE (SMS & WHATSAPP)
 * -------------------------------------------------------------
 */

export async function sendNotification({
  to,
  message,
  channel,
  appointmentId,
}: SendNotificationParams): Promise<DispatchResult[]> {
  const selectedChannel: NotificationChannel =
    channel || (process.env.NOTIFICATION_CHANNEL as NotificationChannel) || 'SMS';

  const results: DispatchResult[] = [];

  // Helper to log to database
  const logResult = async (res: DispatchResult) => {
    if (appointmentId) {
      try {
        await db.insert(notificationLogs).values({
          appointmentId,
          channel: res.channel,
          recipientPhone: to,
          messageBody: message,
          status: res.success ? 'SENT' : 'FAILED',
          sentAt: res.success ? new Date() : null,
          errorMessage: res.error || null,
        });
      } catch (err) {
        console.error('Failed saving notification log:', err);
      }
    }
  };

  // --- Send SMS if requested ---
  if (selectedChannel === 'SMS' || selectedChannel === 'BOTH') {
    const smsProvider = (process.env.SMS_PROVIDER || 'MOCK').toUpperCase();
    let smsRes: DispatchResult;

    try {
      if (smsProvider === 'TWILIO') {
        smsRes = await sendViaTwilioSms(to, message);
      } else if (smsProvider === 'SSL_WIRELESS' || smsProvider === 'SSLWIRELESS') {
        smsRes = await sendViaSslWirelessSms(to, message);
      } else {
        console.log(`\n📱 [SMS MOCK DISPATCH] To: ${to}\nMessage: "${message}"\n`);
        smsRes = {
          success: true,
          channel: 'SMS',
          provider: 'MOCK_SMS',
          messageId: `mock_sms_${Date.now()}`,
        };
      }
    } catch (err: any) {
      smsRes = {
        success: false,
        channel: 'SMS',
        provider: smsProvider,
        error: err.message,
      };
    }

    await logResult(smsRes);
    results.push(smsRes);
  }

  // --- Send WhatsApp if requested ---
  if (selectedChannel === 'WHATSAPP' || selectedChannel === 'BOTH') {
    const waProvider = (process.env.WHATSAPP_PROVIDER || process.env.SMS_PROVIDER || 'MOCK').toUpperCase();
    let waRes: DispatchResult;

    try {
      if (waProvider === 'TWILIO') {
        waRes = await sendViaTwilioWhatsApp(to, message);
      } else if (waProvider === 'META' || waProvider === 'FACEBOOK') {
        waRes = await sendViaMetaWhatsApp(to, message);
      } else {
        console.log(`\n💬 [WHATSAPP MOCK DISPATCH] To: ${to}\nMessage: "${message}"\n`);
        waRes = {
          success: true,
          channel: 'WHATSAPP',
          provider: 'MOCK_WHATSAPP',
          messageId: `mock_wa_${Date.now()}`,
        };
      }
    } catch (err: any) {
      waRes = {
        success: false,
        channel: 'WHATSAPP',
        provider: waProvider,
        error: err.message,
      };
    }

    await logResult(waRes);
    results.push(waRes);
  }

  return results;
}

// Backwards compatibility helper for sendSms
export async function sendSms(params: { to: string; message: string; appointmentId?: string }) {
  const results = await sendNotification({ ...params, channel: 'SMS' });
  return results[0] || { success: false, channel: 'SMS', provider: 'MOCK' };
}

/**
 * Generate a direct Click-to-Chat WhatsApp URL for the assistant
 * to send from their phone or WhatsApp Web with 0 API setup.
 */
export function generateWhatsAppDirectLink(phoneNumber: string, message: string): string {
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Checks if estimated time shifted by > 15 minutes.
 * If so, dispatches an alert (SMS / WhatsApp) to the patient.
 */
export async function checkAndDispatchTimeChangeAlert({
  appointmentId,
  serialNumber,
  recipientPhone,
  recipientName = 'Patient',
  chamberName = 'Clinic',
  trackingToken,
  oldEstimatedTime,
  newEstimatedTime,
}: {
  appointmentId: string;
  serialNumber: number;
  recipientPhone: string;
  recipientName?: string;
  chamberName?: string;
  trackingToken: string;
  oldEstimatedTime: Date | null;
  newEstimatedTime: Date;
}): Promise<{ triggered: boolean; deltaMins?: number }> {
  if (!oldEstimatedTime) {
    return { triggered: false };
  }

  const oldMs = new Date(oldEstimatedTime).getTime();
  const newMs = new Date(newEstimatedTime).getTime();
  const deltaMs = newMs - oldMs;
  const deltaMins = Math.round(Math.abs(deltaMs) / (60 * 1000));

  if (deltaMins > 15) {
    const isDelay = deltaMs > 0;
    const formattedTime = newEstimatedTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const changeType = isDelay ? 'delayed' : 'moved earlier';
    const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/track/${trackingToken}`;

    const message = `Clinic Alert: Hello ${recipientName}, your Serial #${serialNumber} at ${chamberName} is ${changeType} by ~${deltaMins} mins. New estimated turn: ${formattedTime}. Live track: ${trackingUrl}`;

    // Dispatches via user's configured notification channel (SMS, WhatsApp, or BOTH)
    await sendNotification({
      to: recipientPhone,
      message,
      appointmentId,
    });

    return { triggered: true, deltaMins };
  }

  return { triggered: false, deltaMins };
}
