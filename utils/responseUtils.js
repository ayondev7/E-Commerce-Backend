export function successResponse(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function errorResponse(res, error, statusCode = 500) {
  return res.status(statusCode).json({
    success: false,
    error: typeof error === 'string' ? error : error.message,
  });
}

export function validationErrorResponse(res, errors) {
  return res.status(400).json({
    success: false,
    errors,
  });
}

export function unauthorizedResponse(res, message = 'Unauthorized') {
  return res.status(401).json({
    success: false,
    error: message,
  });
}

export function notFoundResponse(res, message = 'Resource not found') {
  return res.status(404).json({
    success: false,
    error: message,
  });
}
