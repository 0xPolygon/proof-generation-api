import type { Response } from 'express';

interface ResponseParams {
  res: Response;
  data: any;
  statusCode?: number;
}

interface ErrorParams {
  res: Response;
  statusCode?: number;
  errMsg?: string;
  err?: string | Error;
}

// successful response
export const handleResponse = ({
  res,
  data,
  statusCode = 200,
}: ResponseParams) => {
  return res.status(statusCode).json(data);
};

// 404 response for hitting an invalid endpoint
export const handleInvalidEndpoint = ({
  res,
  statusCode = 404,
  errMsg = 'Not Found',
  err = 'Endpoint Not found',
}: ErrorParams) => {
  return res.status(statusCode).json({
    errMsg,
    msg: err instanceof Error ? err.message : err?.toString() || errMsg,
  });
};

// 400 response for sending invalid or incomplete params
export const handleBadRequest = ({
  res,
  statusCode = 400,
  errMsg = 'Bad Request',
  err = 'Bad Request',
}: ErrorParams) => {
  return res.status(statusCode).json({
    error: true,
    msg: err instanceof Error ? err.message : errMsg || err?.toString(),
  });
};

// Error response handler
// 500 for server error
// 404 and 400 for Info errors
export const handleError = ({
  res,
  statusCode = 500,
  errMsg = 'Something went wrong while computing',
  err = 'error',
}: ErrorParams) => {
  return res.status(statusCode).json({
    error: true,
    message: err instanceof Error ? err.message : errMsg || err?.toString(),
  });
};
