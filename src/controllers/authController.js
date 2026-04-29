const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { validateSignup, validateLogin } = require('../validators/authValidator');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// @desc    Register user
// @route   POST /api/auth/signup
// @access  Public
const signup = async (req, res) => {
  try {
    console.log('📝 Signup request body:', req.body);
    
    const { name, email, password, role, profilePicture, specialty, phone, institution } = req.body;

    const validation = validateSignup(req.body, role);
    console.log('1️⃣ Validation result:', validation.isValid);
    
    if (!validation.isValid) {
      return errorResponse(res, 'Validation failed', 400, validation.errors);
    }

    console.log('2️⃣ Checking if user exists...');
    const userExists = await User.findOne({ email });
    console.log('3️⃣ User exists:', userExists ? 'YES' : 'NO');
    
    if (userExists) {
      return errorResponse(res, 'User already exists', 400);
    }

    console.log('4️⃣ Building user data...');
    const userData = {
      name,
      email,
      password,
      role,
      profilePicture: profilePicture || '',
    };

    if (role === 'lecturer') {
      userData.specialty = specialty || '';
      userData.phone = phone || '';
      userData.institution = institution || '';
    }
    console.log('5️⃣ User data:', JSON.stringify(userData, null, 2));


    console.log('6️⃣ Creating user in MongoDB...');
    const user = await User.create(userData);
    console.log('7️⃣ User created successfully:', user._id);

    
    const token = generateToken(user._id, user.role);

    const userResponse = user.toObject();
    delete userResponse.password;

    console.log('8️⃣ Sending success response');
    return successResponse(res, { user: userResponse, token }, 'User created successfully', 201);
    
  } catch (error) {console.error('❌ Signup error:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
    if (error.code === 11000) {
      console.error('❌ Duplicate key error - email already exists');
    }
    return errorResponse(res, error.message, 500);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    const validation = validateLogin(req.body);
    if (!validation.isValid) {
      return errorResponse(res, 'Validation failed', 400, validation.errors);
    }

    const user = await User.findOne({ email });
    if (!user) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    if (role && user.role !== role) {
      return errorResponse(res, `Please login as ${user.role}`, 401);
    }

    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    const token = generateToken(user._id, user.role);

    const userResponse = user.toObject();
    delete userResponse.password;

    return successResponse(res, { user: userResponse, token }, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse(res, error.message, 500);
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    return successResponse(res, user, 'User fetched successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

module.exports = {
  signup,
  login,
  getMe,
};
