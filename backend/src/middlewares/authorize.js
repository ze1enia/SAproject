/**
 * Role guard. Use after authMiddleware, which puts the decoded token on req.user.
 *
 *   router.get('/products', authenticate, authorize('Owner'), handler);
 *
 * Called with no roles it only checks that the request is authenticated.
 */
module.exports = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Token not found, access denied'
    });
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to access this resource'
    });
  }

  return next();
};
