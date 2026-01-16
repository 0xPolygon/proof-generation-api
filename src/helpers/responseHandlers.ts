import type { Context } from 'hono';

interface ResponseParams {
  c: Context;
  data: any;
  statusCode?: number;
}

interface ErrorParams {
  c: Context;
  statusCode?: number;
  errMsg?: string;
  err?: string | Error;
}

// successful response
export const handleResponse = ({
  c,
  data,
  statusCode = 200,
}: ResponseParams) => {
  return c.json(data, statusCode as any);
};

// 404 response for hitting an invalid endpoint
export const handleInvalidEndpoint = ({
  c,
  statusCode = 404,
  errMsg = 'Not Found',
  err = 'Endpoint Not found',
}: ErrorParams) => {
  return c.json(
    {
      errMsg,
      msg: err instanceof Error ? err.message : err?.toString() || errMsg,
    },
    statusCode as any,
  );
};

// 400 response for sending invalid or incomplete params
export const handleBadRequest = ({
  c,
  statusCode = 400,
  errMsg = 'Bad Request',
  err = 'Bad Request',
}: ErrorParams) => {
  return c.json(
    {
      error: true,
      msg: err instanceof Error ? err.message : errMsg || err?.toString(),
    },
    statusCode as any,
  );
};

// Error response handler
// 500 for server error
// 404 and 400 for Info errors
export const handleError = ({
  c,
  statusCode = 500,
  errMsg = 'Something went wrong while computing',
  err = 'error',
}: ErrorParams) => {
  return c.json(
    {
      error: true,
      message: err instanceof Error ? err.message : errMsg || err?.toString(),
    },
    statusCode as any,
  );
};
