/**
 * Centralized logging utility
 * Provides consistent logging across the application
 */

const LOG_LEVELS = {
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    SUCCESS: 'SUCCESS'
};

const COLORS = {
    INFO: '\x1b[36m',    // Cyan
    WARN: '\x1b[33m',    // Yellow
    ERROR: '\x1b[31m',   // Red
    SUCCESS: '\x1b[32m', // Green
    RESET: '\x1b[0m'
};

class Logger {
    static log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const color = COLORS[level] || COLORS.RESET;
        const prefix = `${color}[${timestamp}] [${level}]${COLORS.RESET}`;
        
        console.log(`${prefix} ${message}`);
        if (data) {
            console.log(JSON.stringify(data, null, 2));
        }
    }

    static info(message, data = null) {
        this.log(LOG_LEVELS.INFO, message, data);
    }

    static warn(message, data = null) {
        this.log(LOG_LEVELS.WARN, message, data);
    }

    static error(message, data = null) {
        this.log(LOG_LEVELS.ERROR, message, data);
    }

    static success(message, data = null) {
        this.log(LOG_LEVELS.SUCCESS, message, data);
    }
}

export default Logger;
