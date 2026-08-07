export abstract class Exception extends Error {
  protected constructor(message: string) {
    super(message);
  }
}

export class APIException extends Exception {
  constructor(
    message: string,
    public statusCode: number,
    public requestURL: string,
    public responseData: unknown,
    public errorId: string | null,
    public errorCode: string | null
  ) {
    super(message);
    this.name = 'APIException';
  }
}

export class NetworkConnectionException extends Exception {
  constructor(
    message: string,
    public requestURL: string,
    public originalErrorMessage: string = ''
  ) {
    super(message);
    this.name = 'NetworkConnectionException';
  }
}

export class JavaScriptException extends Exception {
  constructor(
    message: string,
    public originalError: unknown
  ) {
    super(message);
    this.name = 'JavaScriptException';
  }
}
