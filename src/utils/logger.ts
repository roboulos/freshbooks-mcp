/**
 * Log levels for the MCP server
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

/**
 * Configuration for the logger
 */
interface LoggerConfig {
  level: LogLevel;
  includeTimestamp: boolean;
  formatJson: boolean;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  includeTimestamp: true,
  formatJson: true
};

/**
 * Simple logger class for the MCP server
 */
export class Logger {
  private config: LoggerConfig;
  private context: string;
  
  /**
   * Create a new logger instance
   * @param context Context name for the logger
   * @param config Logger configuration
   */
  constructor(context: string, config: Partial<LoggerConfig> = {}) {
    this.context = context;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Log a debug message
   * @param message Message to log
   * @param data Additional data to include
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }
  
  /**
   * Log an info message
   * @param message Message to log
   * @param data Additional data to include
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }
  
  /**
   * Log a warning message
   * @param message Message to log
   * @param data Additional data to include
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }
  
  /**
   * Log an error message
   * @param message Message to log
   * @param error Error object or additional data
   */
  error(message: string, error?: any): void {
    this.log(LogLevel.ERROR, message, error);
  }
  
  /**
   * Format and output a log message
   * @param level Log level
   * @param message Message to log
   * @param data Additional data to include
   */
  private log(level: LogLevel, message: string, data?: any): void {
    // Skip if log level is too low
    if (level < this.config.level) {
      return;
    }
    
    const levelName = LogLevel[level];
    let timestamp = '';
    
    if (this.config.includeTimestamp) {
      timestamp = new Date().toISOString() + ' ';
    }
    
    const logMessage = `${timestamp}[${levelName}] [${this.context}] ${message}`;
    
    // Log to console based on level
    if (data !== undefined) {
      if (data instanceof Error) {
        const formattedData = {
          message: data.message,
          name: data.name,
          stack: data.stack,
          ...(data as any)
        };
        
        if (level === LogLevel.ERROR) {
          if (this.config.formatJson) {
            console.error(logMessage, JSON.stringify(formattedData, null, 2));
          } else {
            console.error(logMessage, formattedData);
          }
        } else if (level === LogLevel.WARN) {
          if (this.config.formatJson) {
            console.warn(logMessage, JSON.stringify(formattedData, null, 2));
          } else {
            console.warn(logMessage, formattedData);
          }
        } else {
          if (this.config.formatJson) {
            console.log(logMessage, JSON.stringify(formattedData, null, 2));
          } else {
            console.log(logMessage, formattedData);
          }
        }
      } else {
        if (level === LogLevel.ERROR) {
          if (this.config.formatJson && typeof data === 'object') {
            console.error(logMessage, JSON.stringify(data, null, 2));
          } else {
            console.error(logMessage, data);
          }
        } else if (level === LogLevel.WARN) {
          if (this.config.formatJson && typeof data === 'object') {
            console.warn(logMessage, JSON.stringify(data, null, 2));
          } else {
            console.warn(logMessage, data);
          }
        } else {
          if (this.config.formatJson && typeof data === 'object') {
            console.log(logMessage, JSON.stringify(data, null, 2));
          } else {
            console.log(logMessage, data);
          }
        }
      }
    } else {
      if (level === LogLevel.ERROR) {
        console.error(logMessage);
      } else if (level === LogLevel.WARN) {
        console.warn(logMessage);
      } else {
        console.log(logMessage);
      }
    }
  }
}

// Export default instance
export default new Logger('McpServer');