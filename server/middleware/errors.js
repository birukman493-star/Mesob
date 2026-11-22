export function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function notFound(req, res) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "That route does not exist." } });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      error: { code: "FILE_TOO_LARGE", message: "Image must be 5 MB or smaller." },
    });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: {
      code: err.code || "SERVER",
      message: status >= 500 ? "Something went wrong." : err.message,
    },
  });
}
