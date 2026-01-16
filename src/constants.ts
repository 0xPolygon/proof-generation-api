// custom error types for better error handling

export const errorTypes = {
  BlockNotIncluded: 'no_block_found',
  IncorrectTx: 'incorrect_transaction',
  TxNotCheckpointed: 'transaction_not_checkpointed',
  ZKEVMError: 'zkevm_bridge_data_error',
};

// FIXME: Import from servercore once we get servercore directory imports fixed
export const serverCoreErrorCodes = {
  // Base error identifier
  base: { BASE_ERROR: 100 },

  // Consumer related error codes
  consumer: {
    UNKNOWN_CONSUMER_ERR: 1000,
  },

  // Datastore related error codes
  datastore: {
    UNKNOWN_DATASTORE_ERR: 2000,
    DATASTORE_AUTH_ERR: 2001,
    DATASTORE_READ_ERROR: 2002,
    DATASTORE_WRITE_ERROR: 2003,
  },

  // External dependencies errors codes
  external: {
    UNKNOWN_EXTERNAL_DEPENDENCY_ERROR: 3000,
  },

  // API related error codes
  api: {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    GATEWAY_ERROR: 502,
    TIMEOUT_ERROR: 504,
  },
};
