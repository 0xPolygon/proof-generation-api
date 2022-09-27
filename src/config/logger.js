// winston logger for logging errors and info level logs into error.log and combined.log

import { createLogger, format, transports } from 'winston'
import config from '../config/globals'

const logFormat = format.combine(
  format.colorize({
    all: true
  }),
  format.label({
    label: '[PROOF-GEN-API]'
  }),
  format.timestamp({
    format: 'YY-MM-DD HH:mm:ss'
  }),
  format.printf(
    info => `${info.timestamp} - ${info.level} : ${info.message}`
  )
)

const httpTransportOptions = {
  host: 'http-intake.logs.datadoghq.com',
  path: '/api/v2/logs?dd-api-key=' + config.datadogApiKey + '&ddsource=nodejs&service=' + config.app.name,
  ssl: true
}

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.json(),
    format.metadata(),
    format.errors({ stack: true }),
    logFormat
  ),
  defaultMeta: { service: 'user-service' },
  transports: [
    //
    // - Write all logs with level `error` and below to `error.log`
    // - Write all logs with level `info` and below to `combined.log`
    //
    new transports.File({ filename: 'log/error.log', level: 'error' }),
    new transports.File({ filename: 'log/combined.log' }),
    httpTransportOptions
  ]
})

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: format.combine(
      format.json(),
      format.metadata(),
      format.errors({ stack: true }),
      logFormat
    )
  }))
}

export default logger
