// Simple fire-and-forget usage logging
interface UsageLogData {
  userId?: string;
  sessionId?: string;
  details?: any;
  env: {
    XANO_BASE_URL: string;
  };
}

export function logUsage(eventType: string, data: UsageLogData): void {
  // Fire and forget - don't await or block
  sendUsageLog(eventType, data).catch(error => {
    // Silent failure - don't throw or block execution
    console.warn('Usage logging failed:', error.message);
  });
}

async function sendUsageLog(eventType: string, data: UsageLogData): Promise<void> {
  const payload = {
    event_type: eventType,
    user_id: data.userId || null,
    session_id: data.sessionId || null,
    details: data.details || {},
    timestamp: new Date().toISOString()
  };

  await fetch(`${data.env.XANO_BASE_URL}/api:Snappy/usage_logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}