const { verifyToken } = require('../utils/jwtUtils');
const AuditLog = require('../models/AuditLog');

// Middleware to verify JWT token
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(500).json({ error: `Auth error: ${error.message}` });
  }
};

// Middleware to check user role
const roleMiddleware = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const hasRole = Array.isArray(requiredRoles)
      ? requiredRoles.includes(req.user.role)
      : req.user.role === requiredRoles;

    if (!hasRole) {
      return res.status(403).json({ 
        error: 'Insufficient permissions. Required role(s): ' + 
               (Array.isArray(requiredRoles) ? requiredRoles.join(', ') : requiredRoles)
      });
    }

    next();
  };
};

// Middleware to log audit trail
const auditLogMiddleware = async (req, res, next) => {
  // Store original res.json method
  const originalJson = res.json;

  // Override res.json to capture response
  res.json = function (data) {
    // Log the action after response is sent
    if (req.user) {
      const logEntry = new AuditLog({
        userId: req.user.userId,
        action: req.body.action || 'api_call',
        entityType: req.body.entityType,
        entityId: req.body.entityId,
        details: {
          path: req.path,
          method: req.method,
          ...req.body,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: res.statusCode >= 400 ? 'failure' : 'success',
        errorMessage: data.error || null,
      });
      
      logEntry.save().catch(err => console.error('Audit log error:', err));
    }

    // Call original json method
    return originalJson.call(this, data);
  };

  next();
};

module.exports = {
  authMiddleware,
  roleMiddleware,
  auditLogMiddleware,
};
