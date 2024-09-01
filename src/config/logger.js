// winston logger for logging errors and info level logs into error.log and combined.log

import { createLogger, format, transports } from 'winston'
import config from '../config/globals'
import Sentry from 'winston-transport-sentry-node'

const options = {
  sentry: {
    dsn: config.sentry.dsn
  },
  level: 'error'
}

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
    (info) => `${info.timestamp} - ${info.level} : ${info.message}`
  )
)

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.json(),
    format.metadata(),
    format.errors({ stack: true }),
    logFormat
  ),
  defaultMeta: { service: 'user-service' },
  transports: [new Sentry(options)]
})

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
logger.add(
  new transports.Console({
    format: format.combine(
      format.json(),
      format.metadata(),
      format.errors({ stack: true }),
      logFormat
    )
  })
)

export default logger
