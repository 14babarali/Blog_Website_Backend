import { User, UserRole } from '../model/userModel.js'; // Adjusted import for UserRole
import generateToken from '../utils/generateToken.js';
import asyncHandler from '../middleware/asyncHandler.js';
import {
  followUserService,
  unfollowUserService,
  banUserService,
  unbanUserService,
} from '../services/userService.js';

// @desc    Authenticate user & get token
// @route   POST /api/users/login
// @access  Public
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    const token = generateToken(user._id, res);

    // Emit user login event using globally available io
    req.app.get('io').emit('userStatus', { userId: user._id, status: 'active' }); // Emit the event to all connected clients

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      roles: user.roles,
      isAdmin: user.hasRole(UserRole.ADMIN),
      profileImage: user.profileImage,
      token,
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, password, profileImage, username, roles } = req.body;

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  // Check if the roles are provided, otherwise assign the default role
  const assignedRoles = roles && roles.length > 0 ? roles : [UserRole.USER];

  const user = await User.createUser({
    fullName,
    email,
    password,
    profileImage: profileImage || 'https://www.example.com/default-profile.jpg',
    username: username || null,
    roles: assignedRoles, // Use the assigned roles
  });

  if (user) {
    const token = generateToken(user._id, res);
    res.status(201).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      isAdmin: user.hasRole(UserRole.ADMIN),
      profileImage: user.profileImage,
      username: user.username,
      roles: user.roles, // Return the roles
      token,
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

// @desc    Logout user & clear token
// @route   POST /api/users/logout
// @access  Private
const logoutUser = asyncHandler(async (req, res) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0),
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'strict',
  });

  // Emit user logout event using globally available io
  req.app.get('io').emit('userStatus', { userId: req.user._id, status: 'inactive' });

  res.status(200).json({ message: 'Logged out successfully' });
});

// @desc    Follow a user
// @route   POST /api/users/follow
// @access  Private
const followUser = asyncHandler(async (req, res) => {
  const { followingId } = req.body;
  const followerId = req.user._id;

  const result = await followUserService(followerId, followingId);
  res.status(200).json(result);
});

// @desc    Unfollow a user
// @route   POST /api/users/unfollow
// @access  Private
const unfollowUser = asyncHandler(async (req, res) => {
  const { followingId } = req.body;
  const followerId = req.user._id;

  const result = await unfollowUserService(followerId, followingId);
  res.status(200).json(result);
});

// @desc    Ban a user (Admin only)
// @route   PATCH /api/users/ban/:id
// @access  Private/Admin
const banUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const result = await banUserService(userId);
  res.status(200).json(result);
});

// @desc    Unban a user (Admin only)
// @route   PATCH /api/users/unban/:id
// @access  Private/Admin
const unbanUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const result = await unbanUserService(userId);
  res.status(200).json(result);
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  res.status(200).json(req.user);
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.fullName = req.body.fullName || user.fullName;
    user.email = req.body.email || user.email;
    user.username = req.body.username || user.username;

    const updatedUser = await user.save();

    res.status(200).json({
      _id: updatedUser._id,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      username: updatedUser.username,
      profileImage: updatedUser.profileImage,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({});
  res.status(200).json(users);
});

// @desc    Get user by ID (Admin only)
// @route   GET /api/users/:id
// @access  Private/Admin
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    res.status(200).json(user);
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Update user (Admin only)
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    // Update user fields conditionally
    user.fullName = req.body.fullName !== undefined ? req.body.fullName : user.fullName;
    user.email = req.body.email !== undefined ? req.body.email : user.email;
    user.username = req.body.username !== undefined ? req.body.username : user.username;

    // Handle roles: Check if roles are provided in the request body
    if (req.body.roles && Array.isArray(req.body.roles)) {
      // Ensure the roles being set are valid
      const validRoles = Object.values(UserRole); // Assuming UserRole is an enum
      const invalidRoles = req.body.roles.filter(role => !validRoles.includes(role));

      if (invalidRoles.length > 0) {
        res.status(400);
        throw new Error(`Invalid roles provided: ${invalidRoles.join(', ')}`);
      }

      user.roles = req.body.roles; // Assign new roles
    }

    // If roles are not provided, the existing roles will remain unchanged

    const updatedUser = await user.save();

    res.status(200).json({
      _id: updatedUser._id,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      roles: updatedUser.roles, // Return updated roles
      username: updatedUser.username,
      profileImage: updatedUser.profileImage,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});



// @desc    Delete user (Admin only)
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    await user.remove();
    res.status(200).json({ message: 'User removed' });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

export {
  authUser,
  registerUser,
  getUserById,
  logoutUser,
  updateUser,
  getUserProfile,
  updateUserProfile,
  getUsers,
  deleteUser,
  followUser,
  unfollowUser,
  banUser,
  unbanUser,
};
