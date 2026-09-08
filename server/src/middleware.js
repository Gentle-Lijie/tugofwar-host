/** 包裹异步路由处理器，把 rejection 交给 Express 错误处理 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** 统一错误响应 */
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err && err.status) {
    return res.status(err.status).json({ error: err.message, ...(err.details ?? {}) });
  }
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
}

/** 抛出带状态码的业务错误 */
export function httpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}
