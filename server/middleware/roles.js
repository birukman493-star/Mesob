export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "You do not have access to this resource." },
      });
    }
    return next();
  };
}
