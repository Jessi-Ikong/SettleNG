// Catch-all error handler — must be registered last, after every
// route and other middleware. Express recognizes an error-handling
// middleware purely by its 4-argument arity, so `next` must stay in
// the signature even though it's never called here.
export function errorHandler(err, req, res, next) {
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err)

  if (res.headersSent) {
    return next(err)
  }

  res.status(500).json({ error: 'Something went wrong' })
}
