module.exports = {

  // successful response
  handleResponse: ({
    res,
    data,
    statusCode = 200
  }) => {
    res.status(statusCode).send(data)
  },

  // 404 response for hitting an invalid endpoint
  handleInvalidEndpoint: ({
    res,
    statusCode = 404,
    errMsg = 'Not Found',
    err = 'Endpoint Not found'
  }) => {
    res.status(statusCode).send({
      errMsg,
      msg: err instanceof Error ? err.message : err.msg || err
    })
  },

  // 400 reponse for sending invalid or incomplete params
  handleBadRequest: ({
    res,
    statusCode = 400,
    errMsg = 'Bad Request',
    err = 'Bad Request'
  }) => {
    res.status(statusCode).send({
      error: true,
      msg: err instanceof Error ? err.message : errMsg || err
    })
  },

  // Error response handler
  // 500 for server error
  // 404 and 400 for Info errors
  handleError: ({
    res,
    statusCode = 500,
    errMsg = 'Something went wrong while computing',
    err = 'error'
  }) => {
    res.status(statusCode).send({
      error: true,
      message: err instanceof Error ? err.message : errMsg || err
    })
  }
}
