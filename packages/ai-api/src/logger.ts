import {
  APIException,
  Exception,
  JavaScriptException,
  NetworkConnectionException,
} from './exception';

interface Log {
  date: Date;
  action: string;
  result: 'OK' | 'WARN' | 'ERROR';
  elapsedTime: number;
  info: { [key: string]: string }; // Text data for view only, key in lowercase with underscore, e.g: some_field
  stats: { [key: string]: number }; // Numerical data for Elastic Search and statistics, key in lowercase with underscore, e.g: some_field
  errorCode?: string | undefined; // Naming in uppercase with underscore, e.g: SOME_ERROR
  errorMessage?: string | undefined;
}

interface InfoLogEntry {
  action: string;
  elapsedTime?: number;
  info?: { [key: string]: string | undefined };
  stats?: { [key: string]: number | undefined };
  context?: { [key: string]: string | undefined };
}

interface ErrorLogEntry extends InfoLogEntry {
  errorCode: string;
  errorMessage: string;
}

export class Logger {
  appName: string;
  url: string;
  constructor(appName: string, url: string) {
    this.appName = appName;
    this.url = url;
  }

  private createLog(
    result: 'OK' | 'WARN' | 'ERROR',
    entry: InfoLogEntry | ErrorLogEntry
  ): Log | undefined {
    if (!this.url) {
      console.info(`==== ${result} ====`);
      let error: string | undefined;
      if (result !== 'OK') {
        error = (entry as ErrorLogEntry).errorMessage;
        delete (entry as any).errorMessage;
      }
      console.info(entry);
      if (error) {
        console.error(error);
      }
      return;
    }
    // Generate info
    const info: { [key: string]: string } = {};
    if (entry.info) {
      Object.entries(entry.info).forEach(([key, value]) => {
        if (value !== undefined) {
          info[key] = value.substring(0, 500000);
        }
      });
    }
    // Generate stats
    const stats: { [key: string]: number } = {};
    if (entry.stats) {
      Object.entries(entry.stats).map(([key, value]) => {
        if (value !== undefined) {
          stats[key] = value;
        }
      });
    }
    return {
      date: new Date(),
      action: entry.action,
      elapsedTime: entry.elapsedTime || 0,
      result,
      info,
      stats,
      errorCode: 'errorCode' in entry ? entry.errorCode : undefined,
      errorMessage:
        'errorMessage' in entry
          ? entry.errorMessage.substring(0, 1000)
          : undefined,
    };
  }

  info(entry: InfoLogEntry) {
    this.send(this.createLog('OK', entry));
  }

  error(entry: ErrorLogEntry) {
    this.send(this.createLog('ERROR', entry));
  }

  exception(exception: Exception, entry: InfoLogEntry): void {
    let isWarning: boolean;
    let errorCode: string;
    const info: { [key: string]: string | undefined } = entry.info || {};

    if (exception instanceof NetworkConnectionException) {
      isWarning = true;
      errorCode = 'NETWORK_FAILURE';
      info['api_url'] = exception.requestURL;
      info['original_message'] = exception.originalErrorMessage;
    } else if (exception instanceof APIException) {
      if (
        exception.statusCode === 400 &&
        exception.errorCode === 'VALIDATION_ERROR'
      ) {
        isWarning = false;
        errorCode = 'API_VALIDATION_ERROR';
      } else {
        isWarning = true;
        errorCode = `API_ERROR_${exception.statusCode}`;
      }
      info['api_url'] = exception.requestURL;
      info['api_response'] = JSON.stringify(exception.responseData);
      if (exception.errorId) {
        info['api_error_id'] = exception.errorId;
      }
      if (exception.errorCode) {
        info['api_error_code'] = exception.errorCode;
      }
    } else if (exception instanceof JavaScriptException) {
      isWarning = false;
      errorCode = 'JAVASCRIPT_ERROR';
      // info['app_state'] = JSON.stringify(app.store.getState().app);
    } else {
      console.warn('javascript error');
      isWarning = false;
      errorCode = 'JAVASCRIPT_ERROR';
    }

    this.createLog(isWarning ? 'WARN' : 'ERROR', {
      ...entry,
      errorCode,
      errorMessage: exception.message,
      info,
    });
  }

  async send(log: Log | undefined) {
    if (!log) return;
    if (this.url) {
      await fetch(`${this.url}/${this.appName}`, {
        method: 'POST',
        headers: {
          'with-credentials': 'true',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          events: [log],
        }),
      });
    }
  }
}
