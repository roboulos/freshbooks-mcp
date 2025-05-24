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
    session_id: data.sessionId || '',
    user_id: data.userId || '',
    tool_name: data.details?.tool || eventType,
    params: data.details || {},
    result: data.details?.result || {},
    error: data.details?.error || '',
    duration: data.details?.duration || 0,
    timestamp: Date.now(),
    ip_address: '',
    ai_model: 'claude-3.5-sonnet',
    cost: 0
  };

  const response = await fetch(`${data.env.XANO_BASE_URL}/api:q3EJkKDR/usage_logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
}