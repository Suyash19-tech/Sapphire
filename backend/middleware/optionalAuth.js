const jwt = require('jsonwebtoken');

// Optional authentication - doesn't block if no token
module.exports = (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
            // No token provided - continue as guest
            console.log('ℹ️ [Optional Auth] No token - guest order');
            req.user = null;
            return next();
        }

        // Token provided - verify it
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        console.log('✅ [Optional Auth] Token verified for user:', decoded.id);
        req.user = decoded;
        next();
    } catch (err) {
        // Invalid token - continue as guest
        console.log('⚠️ [Optional Auth] Invalid token - continuing as guest');
        req.user = null;
        next();
    }
};
