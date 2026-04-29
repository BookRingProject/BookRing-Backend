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

const app = express();

// Allowed origins (including StackBlitz patterns)
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://bookring.onrender.com',
  'https://bookring.vercel.app',
  /\.stackblitz\.io$/,
  /\.webcontainer\.io$/,
  /\.credentialless-staticblitz\.com$/,
  /\.local-credentialless\.webcontainer\.io$/,
];

// CORS options
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(pattern => {
      if (typeof pattern === 'string') return pattern === origin;
      return pattern.test(origin);
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      // Still allow for now - temporary fix
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-forwarded-host',
    'X-Forwarded-Host',
    'x-forwarded-proto',
    'X-Forwarded-Proto',
    'x-forwarded-for',
    'X-Forwarded-For',
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
};

// Apply CORS
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/lecturers', lecturerRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/trending', trendRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Bookring API is running' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

// Error middleware (last)
app.use(errorMiddleware);

module.exports = app;
