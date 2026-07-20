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

// CORS - Allow ALL origins (for development/StackBlitz)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-forwarded-host', 'x-forwarded-port',  'X-Forwarded-Host', 'x-forwarded-proto', 'X-Forwarded-Proto', 'x-forwarded-for', 'X-Forwarded-For'],
}));

// Handle preflight requests
app.options('*', cors());

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
app.use('/api/saves', saveRoutes);
app.use('/api/follows', followRoutes);
app.use('/api/chat', chatRoutes);

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
