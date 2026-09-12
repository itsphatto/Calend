const ratelimit = require('express-rate-limit');

const limiter = ratelimit({
    windowMs: 15 * 60 * 1000,
    max: 3, 
    message: 'Too many requests, please try again later.',
});

app.use(limiter);
app.use('/api/', limiter);