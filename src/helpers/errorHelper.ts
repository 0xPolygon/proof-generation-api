// custom errors for better error handling

// InfoError is thrown when the parameters received are valid but incorrect
export class InfoError extends Error {
  type: string;

  constructor(type: string, message: string) {
    super(message);
    this.type = type;
  }
}
