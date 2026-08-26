'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const errorMiddleware = require('./middleware/errorMiddleware');

// Import routes
const authRoutes = require('./routes/authRoutes');
const bookRoutes = require('./routes/bookRoutes');
const lecturerRoutes = require('./routes/lecturerRoutes');
const studentRoutes = require('./routes/studentRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const trendRoutes = require('./routes/trendRoutes');
const userRoutes = require('./routes/userRoutes');
const saveRoutes = require('./routes/saveRoutes');
const followRoutes = require('./routes/followRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();

/**
 * ============================================================
 * CORS CONFIGURATION
 * ============================================================
 *
 * Production frontend:
 *   https://bookring.vercel.app
 *
 * Local development:
 *   http://localhost:3000
 *   http://localhost:5173
 *
 * You can add additional frontend URLs through:
 *
 * CORS_ORIGINS=https://bookring.vercel.app,http://localhost:3000
 *
 * Do NOT use "*" when credentials are enabled.
 */

const defaultAllowedOrigins = [
  'https://bookring.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

const envAllowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [];

const allowedOrigins = [
  ...new Set([
    ...defaultAllowedOrigins,
    ...envAllowedOrigins,
  ]),
];

console.log('🌐 [CORS] Allowed origins:');
allowedOrigins.forEach((origin) => {
  console.log(`   ✅ ${origin}`);
});

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without an Origin header.
    //
    // This is useful for:
    // - server-to-server requests
    // - health checks
    // - Render/internal requests
    // - command-line tools
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(
      `🚫 [CORS] Blocked origin: ${origin}`
    );

    return callback(
      new Error(`CORS policy blocked origin: ${origin}`)
    );
  },

  credentials: true,

  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
  ],

  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
  ],

  exposedHeaders: [
    'Content-Length',
    'Content-Type',
  ],

  optionsSuccessStatus: 204,
};

/**
 * IMPORTANT:
 * CORS must be registered BEFORE your routes.
 */
app.use(cors(corsOptions));

/**
 * Explicit preflight handling.
 */
app.options('*', cors(corsOptions));

/**
 * ============================================================
 * BODY PARSING
 * ============================================================
 */

app.use(
  express.json({
    limit: '10mb',
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  })
);

/**
 * ============================================================
 * LOGGING
 * ============================================================
 */

app.use(morgan('dev'));

/**
 * ============================================================
 * STATIC FILES
 * ============================================================
 */

app.use(
  '/uploads',
  express.static(
    path.join(__dirname, '../uploads')
  )
);

/**
 * ============================================================
 * API ROUTES
 * ============================================================
 */

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/lecturers', lecturerRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/trending', trendRoutes);
app.use('/api/users', userRoutes);
app.use('/api/saves', saveRoutes);
app.use('/api/follows', followRoutes);
app.use('/api/chat', chatRoutes);

/**
 * ============================================================
 * HEALTH CHECK
 * ============================================================
 */

app.get('/health', (req, res) => {
  return res.status(200).json({
    success: true,
    status: 'ok',
    message: 'Bookring API is running',
  });
});

/**
 * ============================================================
 * 404 HANDLER
 * ============================================================
 */

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

/**
 * ============================================================
 * GLOBAL ERROR HANDLER
 * Must remain LAST.
 * ============================================================
 */

app.use(errorMiddleware);

module.exports = app;
