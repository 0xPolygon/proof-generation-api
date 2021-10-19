// custom errors for better error handling

// InfoError is thrown when the parameters received are valid but incorrect
export class InfoError extends Error {
  constructor(type, message) {
    super(message)
    this.type = type
  }
}
