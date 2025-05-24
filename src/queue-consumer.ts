import { AuthenticatedEnv } from './mcp-auth-middleware'

interface QueueMessage {
  body: string
  id: string
  timestamp: string
}

export default {
  async queue(
    batch: MessageBatch<QueueMessage>,
    env: AuthenticatedEnv
  ): Promise<void> {
    // Process messages in batches
    const usageLogs = batch.messages.map(message => {
      try {
        return JSON.parse(message.body)
      } catch (error) {
        console.error('Failed to parse message:', error)
        // Mark as processed anyway to avoid reprocessing
        message.ack()
        return null
      }
    }).filter(Boolean)

    if (usageLogs.length === 0) {
      return
    }

    try {
      // Send batch to Xano
      const response = await fetch(`${env.XANO_BASE_URL}${env.XANO_API_ENDPOINT}/usage_logs/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ logs: usageLogs })
      })

      if (response.ok) {
        // Acknowledge all messages
        batch.messages.forEach(msg => msg.ack())
      } else {
        // Retry later
        batch.messages.forEach(msg => msg.retry())
      }
    } catch (error) {
      console.error('Failed to send usage logs to Xano:', error)
      // Retry all messages
      batch.messages.forEach(msg => msg.retry())
    }
  }
}

interface MessageBatch<T> {
  readonly queue: string
  readonly messages: Message<T>[]
}

interface Message<T> {
  readonly id: string
  readonly timestamp: Date
  readonly body: T
  ack(): void
  retry(): void
}