const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        console.log('Auth header received:', authHeader ? 'Yes' : 'No');
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
            console.log('No token provided');
            return res.status(401).json({ error: 'No token, authorization denied' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        console.log('Token verified for user:', decoded.id);
        req.user = decoded;
        next();
    } catch (err) {
        console.error('Auth Error:', err.message);
        res.status(401).json({ error: 'Token is not valid' });
    }
};
